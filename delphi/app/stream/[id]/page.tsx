"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Music2, Download, Play, Square, Target, Send, Wifi, ArrowLeft, Users, Loader2 } from "lucide-react";
import { mockStreams } from "@/lib/mock-data";
import { extractYouTubeVideoId } from "@/lib/youtube-utils";
import { YouTubePlayer } from "@/components/youtube-player";
import Link from "next/link";

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

export default function StreamPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;
  
  const stream = mockStreams.find((s) => s.id === streamId);
  
  // State (only for UI updates)
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [seekSeconds, setSeekSeconds] = useState("");
  const [audioChunks, setAudioChunks] = useState(0);
  const [dataReceived, setDataReceived] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs for mutable state that shouldn't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const isBufferingRef = useRef(true);
  const bufferedDurationRef = useRef(0);
  const chunkCountRef = useRef(0);
  const totalBytesRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const hasStartedPlayingRef = useRef<number | false>(false);
  const hasAutoStartedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const connectionStartTimeRef = useRef(0);
  const hasAttemptedConnectionRef = useRef(false);
  const effectMountedRef = useRef(false);

  // Use stream URL if found
  const youtubeUrl = stream?.url || "https://www.youtube.com/watch?v=z9Ug-3qhrwY";
  
  // Extract YouTube video ID
  const videoId = extractYouTubeVideoId(youtubeUrl);

  // Update stats without causing re-render
  const updateStats = useCallback((chunks: number, bytes: number) => {
    chunkCountRef.current = chunks;
    totalBytesRef.current = bytes;
    setAudioChunks(chunks);
    setDataReceived(bytes);
  }, []);

  // Handle JSON messages from WebSocket
  const handleJsonMessage = useCallback((data: any) => {
    if (data.type === 'session') {
      setSessionId(data.session_id);
    } else if (data.type === 'pong') {
      // Heartbeat response - no action needed
    } else if (data.type === 'prompt_received') {
      // Prompt was received - could show notification here
    } else if (data.type === 'seek_confirmed') {
      // Seek was confirmed - COMPLETELY IGNORE during first 10 seconds to prevent ANY resets
      const timeSinceStart = hasStartedPlayingRef.current 
        ? Date.now() - hasStartedPlayingRef.current
        : Infinity;
      
      // Ignore ALL seek confirmations for first 10 seconds
      if (timeSinceStart < 10000) {
        console.log(`🚫 BLOCKING seek confirmation during early playback (${timeSinceStart}ms) - offset: ${data.offset}`);
        return;
      }
      
      // Don't seek if we're already processing a seek (avoid reset loops)
      if (youtubePlayerRef.current && data.offset !== undefined && !isSeekingRef.current && hasStartedPlayingRef.current && data.offset > 1) {
        try {
          const currentTime = youtubePlayerRef.current.getCurrentTime();
          const diff = Math.abs(currentTime - data.offset);
          
          // EXTREMELY strict: Only seek forward and only if HUGE difference
          // Never seek backwards, never seek to beginning
          const shouldSeek = diff > 10 && data.offset > currentTime + 5; // Must be at least 5 seconds ahead and 10s difference
          
          if (shouldSeek && !(data.offset < 2 && currentTime > 5)) {
            console.log(`✅ Seek confirmed: syncing YouTube player forward from ${currentTime.toFixed(1)}s to ${data.offset}s`);
            youtubePlayerRef.current.seekTo(data.offset, true);
          } else {
            console.log(`🚫 Skipping seek sync: diff=${diff.toFixed(1)}s, backend=${data.offset.toFixed(1)}s, current=${currentTime.toFixed(1)}s (not significant enough or backwards)`);
          }
        } catch (e) {
          console.error('Error syncing YouTube player on seek confirmation:', e);
        }
      }
    }
  }, []);

  // Handle audio data (Blob)
  const handleAudioData = useCallback(async (blob: Blob) => {
    const newChunkCount = chunkCountRef.current + 1;
    const newTotalBytes = totalBytesRef.current + blob.size;
    updateStats(newChunkCount, newTotalBytes);

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      isBufferingRef.current = true;
      bufferedDurationRef.current = 0;
      nextPlayTimeRef.current = 0;
    }

    const audioContext = audioContextRef.current;
    const bufferTargetSeconds = 1.5;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pcmData = new Int16Array(arrayBuffer);
      
      const sampleRate = 48000;
      const numChannels = 2;
      const numFrames = pcmData.length / numChannels;
      
      const audioBuffer = audioContext.createBuffer(numChannels, numFrames, sampleRate);
      
      // Deinterleave and convert to float [-1, 1]
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < numFrames; i++) {
          channelData[i] = pcmData[i * numChannels + channel] / 32768.0;
        }
      }
      
      const chunkDuration = audioBuffer.duration;
      
      // Buffer management
      if (isBufferingRef.current) {
        bufferedDurationRef.current += chunkDuration;
        
        if (bufferedDurationRef.current >= bufferTargetSeconds || chunkCountRef.current >= 3) {
          isBufferingRef.current = false;
          nextPlayTimeRef.current = audioContext.currentTime + 0.1;
        }
      }
      
      // Play the audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      if (!isBufferingRef.current) {
        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;
      } else {
        const startTime = nextPlayTimeRef.current || (audioContext.currentTime + 0.1);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;
      }
      
    } catch (error) {
      console.error('Audio processing error:', error);
    }
  }, [updateStats]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('WebSocket connection already in progress, skipping...');
      return;
    }
    
    // If already connected, don't reconnect
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping...');
      return;
    }
    
    // Additional check: if there's a WebSocket instance (even if not open yet), don't create another
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting, skipping duplicate connection...');
      return;
    }
    
    // Close existing connection if any (but not if it's already connecting)
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      } else if (wsRef.current.readyState !== WebSocket.CONNECTING) {
        // Only clear if not in connecting state
        wsRef.current = null;
      } else {
        // If connecting, don't create a new one
        console.log('WebSocket is connecting, not creating duplicate');
        return;
      }
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    connectionStartTimeRef.current = Date.now();

    try {
      console.log(`Connecting to WebSocket: ${WS_URL}`);
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        wsRef.current = ws;
        setIsConnected(true);
        setIsConnecting(false);
        hasConnectedRef.current = true;
        isConnectingRef.current = false;
        hasAttemptedConnectionRef.current = false; // Reset so we can reconnect if needed
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Audio data
          await handleAudioData(event.data);
        } else {
          // JSON message
          try {
            const data = JSON.parse(event.data);
            handleJsonMessage(data);
          } catch (e) {
            console.error('Failed to parse JSON message:', e, event.data);
          }
        }
      };

      ws.onerror = (error) => {
        // WebSocket error events don't contain much info
        // Real error details come from onclose event
        console.error('WebSocket error event:', error);
        console.error('WebSocket state:', ws.readyState);
        console.error('WebSocket URL:', WS_URL);
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        const connectionAge = Date.now() - connectionStartTimeRef.current;
        const wasAbnormalClose = !event.wasClean && event.code === 1006;
        
        console.log(`WebSocket closed - Code: ${event.code}, Reason: ${event.reason || 'No reason'}, WasClean: ${event.wasClean}, Age: ${connectionAge}ms`);
        
        // If connection closed abnormally very quickly, it might be React Strict Mode
        if (wasAbnormalClose && connectionAge < 1000) {
          console.warn('Connection closed abnormally very quickly - likely React Strict Mode double-mount. Will not attempt reconnect.');
          // Don't try to reconnect immediately - wait for next mount
        }
        
        wsRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        setSessionId(null);
        setIsGenerating(false);
        isConnectingRef.current = false;
        // Reset attempt flag only if connection was established (not if it was a quick close)
        if (connectionAge > 1000 || event.wasClean) {
          hasAttemptedConnectionRef.current = false;
        }
        
        // Only reconnect if it was a clean close or we had successfully connected before
        // Don't reconnect if it was a very quick abnormal close (likely Strict Mode)
        if (hasConnectedRef.current && (event.wasClean || (event.code === 1006 && connectionAge > 1000))) {
          console.log('Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (!wsRef.current && !isConnectingRef.current) {
              connectWebSocket();
            }
          }, 3000);
        } else if (!event.wasClean && !(wasAbnormalClose && connectionAge < 1000)) {
          console.error(`Connection closed abnormally with code ${event.code}`);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [handleAudioData, handleJsonMessage]);

  // Auto-connect on mount
  useEffect(() => {
    if (!stream) {
      setTimeout(() => router.push("/discover"), 2000);
      return;
    }

    // Prevent React Strict Mode from running twice - only connect once per mount cycle
    if (effectMountedRef.current) {
      console.log('Effect already ran in this mount cycle, skipping...');
      return;
    }
    effectMountedRef.current = true;

    // Check if already connected or connecting before attempting connection
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping auto-connect');
      // Still setup heartbeat if connected
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('WebSocket connection already in progress, skipping auto-connect');
      return;
    }

    console.log('Auto-connect effect running, will connect in 150ms...');

    // Small delay to prevent React Strict Mode double-connection
    const connectTimer = setTimeout(() => {
      // Double-check all conditions after delay
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected, skipping timer connection');
        return;
      }
      
      if (isConnectingRef.current) {
        console.log('Connection already in progress, skipping timer connection');
        return;
      }
      
      console.log('Timer fired, attempting to connect...');
      connectWebSocket();
    }, 150);

    // Setup heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // Cleanup
    return () => {
      // Clear the connection timer
      if (connectTimer) {
        clearTimeout(connectTimer);
      }
      
      // Reset mount flag on cleanup so it can run again on next mount
      effectMountedRef.current = false;
      
      // Prevent cleanup if connection was just established (React Strict Mode protection)
      const connectionAge = connectionStartTimeRef.current > 0
        ? Date.now() - connectionStartTimeRef.current
        : Infinity;
      const isRecentConnection = connectionAge < 500; // Less than 500ms old
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (wsRef.current) {
        // Only close if connection is established or if it's been a while
        // This prevents closing immediately after opening (React Strict Mode issue)
        if (isRecentConnection && wsRef.current.readyState === WebSocket.CONNECTING) {
          console.log('Skipping cleanup - connection too recent (likely React Strict Mode)');
          // Don't close, just clear the ref - let the connection complete naturally
          wsRef.current = null;
          isConnectingRef.current = false;
        } else {
          // Close gracefully with code 1000 (normal closure)
          try {
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
              wsRef.current.close(1000, 'Component unmounting');
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
          wsRef.current = null;
        }
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore errors during cleanup
        });
        audioContextRef.current = null;
      }
    };
    // Note: connectWebSocket is accessed via closure. It's stable via useCallback but we intentionally
    // don't include it in deps to prevent re-runs when handleAudioData/handleJsonMessage change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, streamId, router]); // Added streamId to ensure it runs when navigating to different streams

  if (!stream) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
        <div className="text-center">
          <p className="text-xl text-white">Stream not found</p>
          <p className="mt-2 text-purple-200">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  const handleStart = useCallback(async () => {
    if (!sessionId || !wsRef.current) {
      console.warn('Cannot start music: missing session ID or WebSocket connection');
      return false;
    }

    try {
      setIsGenerating(true);

      const response = await fetch(`${API_BASE}/api/music/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: youtubeUrl,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          // Try to parse as JSON to get detail message
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) {
              errorText = errorJson.detail;
            }
          } catch {
            // Not JSON, use text as-is
          }
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error(`Failed to start music: ${response.status} ${response.statusText}`, errorText);
        
        // Check if it's a timeout error
        const isTimeout = errorText.includes('timeout') || errorText.includes('timed out');
        
        if (isTimeout) {
          console.warn('Music generation timed out - this may be due to service availability. The video will continue playing.');
        }
        
        setIsGenerating(false);
        return false;
      }

      const result = await response.json();

      if (result.success) {
        // Reset buffering state
        isBufferingRef.current = true;
        bufferedDurationRef.current = 0;
        nextPlayTimeRef.current = 0;
        chunkCountRef.current = 0;
        totalBytesRef.current = 0;
        updateStats(0, 0);
        // Mark that we've started playing immediately when music starts (not delayed)
        // This ensures the blocking timers start right away
        hasStartedPlayingRef.current = Date.now();
        return true;
      } else {
        console.error('Music start returned success=false:', result);
        setIsGenerating(false);
        return false;
      }
    } catch (error) {
      console.error('Error starting music:', error);
      setIsGenerating(false);
      return false;
    }
  }, [sessionId, youtubeUrl, updateStats]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE}/api/music/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      const result = await response.json();

      if (result.success) {
        setIsGenerating(false);
        nextPlayTimeRef.current = 0;
        chunkCountRef.current = 0;
        totalBytesRef.current = 0;
        updateStats(0, 0);
      }
    } catch (error) {
      console.error('Error stopping music:', error);
    }
  }, [sessionId, updateStats]);

  const handleDownload = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE}/api/music/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'gemini_music.wav';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };

  const handleSendPrompt = () => {
    if (!userPrompt.trim() || !sessionId || !wsRef.current) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'prompt',
        prompt: userPrompt
      }));
      setUserPrompt("");
    } catch (error) {
      console.error('Error sending prompt:', error);
    }
  };

  // Handle YouTube player ready
  const handleYouTubeReady = useCallback((player: any) => {
    youtubePlayerRef.current = player;
    // Video is automatically muted by the YouTubePlayer component
    console.log('YouTube player ready');
  }, []);
  
  // Handle YouTube player state changes (play, pause, etc.)
  // Only start music when user presses play AND connection is established
  const handleYouTubeStateChange = useCallback(async (event: any) => {
    // YT.PlayerState: -1 (UNSTARTED), 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING), 5 (CUED)
    const state = event.data;
    
    if (state === 1) { // PLAYING
      // User pressed play on YouTube - start music generation
      // Only start if we have a valid connection and aren't already generating
      if (!isGenerating && isConnected && sessionId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setTimeout(async () => {
          // Double-check conditions after delay
          if (!isGenerating && isConnected && sessionId && wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              await handleStart();
            } catch (error) {
              console.error('Failed to start music generation:', error);
              // Video continues playing even if music generation fails
            }
          }
        }, 200);
      } else if (!isConnected || !sessionId) {
        console.warn('Cannot start music: WebSocket not connected or session not ready');
        // Pause the video if not connected
        if (youtubePlayerRef.current) {
          try {
            youtubePlayerRef.current.pauseVideo();
          } catch (e) {
            // Ignore pause errors
          }
        }
      }
    } else if (state === 2) { // PAUSED
      // User pressed pause on YouTube - stop music generation
      // Only stop if we're actually generating
      if (isGenerating && sessionId) {
        handleStop().catch((error) => {
          console.error('Failed to stop music generation:', error);
        });
      }
    } else if (state === 5) { // CUED
      // Video is ready - this happens after seeks, we don't need to do anything
    }
  }, [isGenerating, isConnected, sessionId, handleStart, handleStop]);

  // Handle YouTube player seek (debounced)
  const handleYouTubeSeek = useCallback((seconds: number) => {
    if (stream?.isLive || !sessionId || !wsRef.current) {
      return; // Don't seek on live streams
    }

    // Ignore seeks during initial playback (first play)
    if (!hasStartedPlayingRef.current) {
      console.log(`Ignoring seek to ${seconds}s - playback not started yet`);
      return;
    }

    // Ignore ALL seeks in first 10 seconds of playback to prevent resets
    const timeSinceStart = hasStartedPlayingRef.current 
      ? Date.now() - hasStartedPlayingRef.current 
      : Infinity;
    if (timeSinceStart < 10000) {
      console.log(`🚫 BLOCKING seek to ${seconds}s - too early in playback (${timeSinceStart}ms)`);
      return;
    }

    // Ignore if we're already processing a seek
    if (isSeekingRef.current) {
      return;
    }

    if (seekDebounceRef.current) {
      clearTimeout(seekDebounceRef.current);
    }

    seekDebounceRef.current = setTimeout(() => {
      if (!isSeekingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        isSeekingRef.current = true;
        try {
          wsRef.current.send(JSON.stringify({
            type: 'seek',
            offset: seconds
          }));
          console.log(`🎯 Seeking to ${seconds}s`);
        } catch (error) {
          console.error('Error sending seek:', error);
          isSeekingRef.current = false;
        }
        // Reset flag after a delay
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 2000);
      }
    }, 800); // 800ms debounce to avoid conflicts with YouTube's native seek
  }, [sessionId, stream?.isLive]);

  const handleSeek = () => {
    const offset = parseFloat(seekSeconds);
    if (isNaN(offset) || offset < 0 || !sessionId || !wsRef.current) {
      return;
    }

    // Programmatically seek YouTube player
    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(offset, true);
      } catch (e) {
        console.error('Error seeking YouTube player:', e);
      }
    }

    // Also send to backend
    try {
      wsRef.current.send(JSON.stringify({
        type: 'seek',
        offset: offset
      }));
      setSeekSeconds("");
    } catch (error) {
      console.error('Error sending seek:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(1)} KB`;
    return `${(bytes / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
      <div className="mx-auto h-full max-w-[95vw] px-2 py-2 sm:px-4 lg:px-6">
        {/* Top Bar - Back, Title */}
        <div className="mb-2 flex items-center justify-between">
          <Link href="/discover">
            <Button variant="ghost" size="sm" className="h-7 text-white hover:bg-white/10 px-2">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              <span className="text-xs">Back</span>
            </Button>
          </Link>
          
          {sessionId && (
            <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-700/50 bg-purple-900/30 px-1.5 py-0.5">
              ID: {sessionId}
            </Badge>
          )}
        </div>

        {/* Stream Info - Compact */}
        <div className="mb-2">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-lg font-bold text-white truncate">{stream.title}</h1>
            {stream.isLive && (
              <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5">
                <span className="relative mr-1 flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-red-500" />
                </span>
                LIVE
              </Badge>
            )}
            {/* Connection Status - Inline with LIVE */}
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
              isConnected 
                ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                : isConnecting
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                : "bg-red-500/20 text-red-400 border border-red-500/50"
            }`}>
              {isConnecting ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <div className={`h-1 w-1 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`} />
              )}
              {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-purple-300">
            <span>{stream.author}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{stream.viewers.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 h-[calc(100vh-120px)]">
          {/* Main Content - Video and Controls */}
          <div className="lg:col-span-4 flex flex-col gap-2 min-h-0">

            {/* Video Display - Main Focus */}
            <Card className="border-purple-700/50 bg-black/50 backdrop-blur-sm overflow-hidden flex-[0.88] min-h-0">
              <CardContent className="p-0 h-full">
                <div className="relative w-full h-full overflow-hidden bg-black">
                  {videoId ? (
                    <>
                      <YouTubePlayer
                        videoId={videoId}
                        isLive={stream.isLive}
                        onReady={handleYouTubeReady}
                        onStateChange={handleYouTubeStateChange}
                        onSeek={handleYouTubeSeek}
                      />
                      {/* Loading overlay when connecting */}
                      {isConnecting && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-12 w-12 text-purple-400 animate-spin mb-4" />
                            <p className="text-white text-lg font-semibold">Connecting to server...</p>
                            <p className="text-purple-300 text-sm mt-2">Please wait</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Music2 className="mx-auto h-12 w-12 text-purple-500/50 mb-2" />
                        <p className="text-gray-400 text-sm mb-1">Invalid YouTube URL</p>
                        <p className="text-xs text-gray-600">{youtubeUrl}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prompt Box */}
            <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendPrompt()}
                    placeholder="Music prompt (optional)..."
                    className="h-8 text-sm border-gray-300 dark:border-gray-700"
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="border-gray-300 dark:border-gray-700"
                    onClick={handleSendPrompt}
                    disabled={!isConnected || !sessionId}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Stats and Additional Controls */}
          <div className="lg:col-span-1 flex flex-col gap-2 min-h-0 overflow-y-auto">
            {/* Control Buttons */}
            <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    onClick={connectWebSocket}
                    disabled={isConnected}
                    size="sm"
                    className="h-8 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-xs px-2"
                    title="Connect"
                  >
                    <Wifi className="mr-1 h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <Button
                    onClick={handleDownload}
                    variant="secondary"
                    size="sm"
                    className="h-8 border-gray-300 dark:border-gray-700 text-xs px-2"
                    title="Download"
                    disabled={!sessionId || audioChunks === 0}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
                <p className="mt-2 text-[10px] text-gray-500 text-center">
                  Use YouTube controls to play/pause
                </p>
              </CardContent>
            </Card>

            {/* Stats Cards - Compact */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
                <CardHeader className="pb-1 px-3 pt-3">
                  <CardDescription className="text-[10px] font-medium">Audio Chunks</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {audioChunks}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
                <CardHeader className="pb-1 px-3 pt-3">
                  <CardDescription className="text-[10px] font-medium">Data Received</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {formatBytes(dataReceived)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Video Scrubbing - Compact */}
            <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
              <CardHeader className="pb-1 px-3 pt-3">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-red-500" />
                  <CardDescription className="text-[10px] font-medium">Test Scrubbing</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    value={seekSeconds}
                    onChange={(e) => setSeekSeconds(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSeek()}
                    placeholder="120"
                    className="h-7 text-xs border-gray-300 dark:border-gray-700"
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 border-gray-300 dark:border-gray-700 px-2"
                    onClick={handleSeek}
                    disabled={!isConnected || !sessionId}
                  >
                    <span className="text-xs">Seek</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stream Details - Compact */}
            <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
              <CardHeader className="pb-1 px-3 pt-3">
                <CardDescription className="text-[10px] font-medium uppercase tracking-wide">Details</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3 space-y-2">
                <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2">
                  {stream.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {stream.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                  <Input
                    type="url"
                    value={youtubeUrl}
                    readOnly
                    className="h-6 text-[10px] border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
