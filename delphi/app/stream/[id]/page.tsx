"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Music2, Download, Play, Square, Send, Wifi, ArrowLeft, Users, Loader2, Pause } from "lucide-react";
import { mockStreams } from "@/lib/mock-data";
import { extractYouTubeVideoId } from "@/lib/youtube-utils";
import { YouTubePlayer } from "@/components/youtube-player";
import Link from "next/link";

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

export default function StreamPage() {
  console.log('🚀 StreamPage component rendering');
  
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;
  
  console.log('📍 Stream ID:', streamId);
  
  const stream = mockStreams.find((s) => s.id === streamId);
  
  console.log('📺 Stream found:', !!stream, stream?.title || 'N/A');
  
  // State (only for UI updates - minimize re-renders while WS connected)
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [audioChunks, setAudioChunks] = useState(0);
  const [dataReceived, setDataReceived] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Refs to track state without re-renders (used when WS is connected)
  const sessionIdRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);

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
  const hasConnectedRef = useRef(false);
  const hasStartedPlayingRef = useRef<number | false>(false);
  const hasAutoStartedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const connectionStartTimeRef = useRef(0);
  const hasAttemptedConnectionRef = useRef(false);
  const effectMountedRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);
  const isUnmountingRef = useRef(false); // Prevent new connections when navigating away

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

  // Handle JSON messages from WebSocket (matches index.html)
  const handleJsonMessage = useCallback((data: any) => {
    console.log(`📨 Received: ${data.type}`, data);

    if (data.type === 'session') {
      console.log(`✅ Session ID: ${data.session_id}`);
      sessionIdRef.current = data.session_id;
      // Only update state if not generating (minimize re-renders when WS connected)
      if (!isGeneratingRef.current) {
        setSessionId(data.session_id);
      }
      
      // Start music generation immediately when session ID is received
      if (!isGeneratingRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🎵 Starting music generation immediately after session received...');
        setTimeout(async () => {
          // Double-check conditions after delay
          if (!isGeneratingRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionIdRef.current) {
            try {
              await handleStart();
            } catch (error) {
              console.error('❌ Failed to auto-start music:', error);
            }
          }
        }, 200);
      }
    } else if (data.type === 'pong') {
      // Heartbeat response - no action needed
      console.log('💓 Pong received');
    } else if (data.type === 'prompt_received') {
      console.log(`✅ Prompt applied and saved to context: "${data.prompt}"`);
      console.log('📝 This prompt will be remembered for all future music generation');
      // Prompt was received - could show notification here
    } else if (data.type === 'seek_confirmed') {
      // Scrubbing removed - ignore seek confirmations
      console.log('⚠️ Seek confirmed received (scrubbing disabled):', data);
    }
  }, []);

  // Handle audio data (Blob) - matches index.html exactly
  const handleAudioData = useCallback(async (blob: Blob) => {
    console.log('🔊 Audio chunk received:', blob.size, 'bytes');
    
    // Update counters exactly like index.html
    chunkCountRef.current = chunkCountRef.current + 1;
    totalBytesRef.current = totalBytesRef.current + blob.size;
    
    console.log('📊 Stats updated:', {
      chunkCount: chunkCountRef.current,
      totalBytes: totalBytesRef.current,
      totalBytesKB: (totalBytesRef.current / 1024).toFixed(1)
    });
    
    updateStats(chunkCountRef.current, totalBytesRef.current);

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      console.log('🎵 Initializing audio context');
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('✅ Audio context initialized');
      // Reset buffering state when starting fresh (matches index.html)
      isBufferingRef.current = true;
      bufferedDurationRef.current = 0;
      nextPlayTimeRef.current = 0;
    }

    const audioContext = audioContextRef.current;
    const bufferTargetSeconds = 1.5;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      
      // Raw PCM data: 16-bit signed integers (matches index.html)
      const pcmData = new Int16Array(arrayBuffer);
      
      // Lyria sends stereo audio (2 channels)
      const sampleRate = 48000;
      const numChannels = 2;
      const numFrames = pcmData.length / numChannels;
      
      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(
        numChannels,
        numFrames,
        sampleRate
      );
      
      // Deinterleave and convert to float [-1, 1] (matches index.html)
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < numFrames; i++) {
          // Convert 16-bit int to float [-1, 1]
          channelData[i] = pcmData[i * numChannels + channel] / 32768.0;
        }
      }
      
      const chunkDuration = audioBuffer.duration;
      console.log(`🎼 Processed audio chunk: ${numFrames} frames (${chunkDuration.toFixed(2)}s)`);
      
      // Buffer management: Only start playback when we have enough buffered (matches index.html)
      if (isBufferingRef.current) {
        bufferedDurationRef.current += chunkDuration;
        console.log(`📦 Buffering... ${bufferedDurationRef.current.toFixed(2)}s / ${bufferTargetSeconds}s`);
        
        if (bufferedDurationRef.current >= bufferTargetSeconds || chunkCountRef.current >= 3) {
          // We have enough buffer, start playback!
          isBufferingRef.current = false;
          nextPlayTimeRef.current = audioContext.currentTime + 0.1; // Small delay to ensure smooth start
          console.log(`✅ Buffer ready! Starting playback with ${bufferedDurationRef.current.toFixed(2)}s buffered`);
        }
      }
      
      // Play the audio with buffering (matches index.html)
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      if (!isBufferingRef.current) {
        // Schedule playback to ensure smooth continuous audio
        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        
        // Update next play time for seamless playback
        nextPlayTimeRef.current = startTime + chunkDuration;
        console.log(`▶️ Playing chunk at ${startTime.toFixed(2)}s, next at ${nextPlayTimeRef.current.toFixed(2)}s`);
        
        // Monitor buffer health
        const bufferHealth = (nextPlayTimeRef.current - audioContext.currentTime);
        if (bufferHealth < 0.5) {
          console.warn(`⚠️ Buffer running low: ${bufferHealth.toFixed(2)}s`);
        } else {
          console.log(`💚 Buffer health: ${bufferHealth.toFixed(2)}s ahead`);
        }
      } else {
        // Still buffering, queue the source for later playback (matches index.html)
        const startTime = nextPlayTimeRef.current || (audioContext.currentTime + 0.1);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;
        console.log(`📥 Queued chunk for buffering at ${startTime.toFixed(2)}s`);
      }
      
    } catch (error) {
      console.error('❌ Audio processing error:', error);
    }
  }, [updateStats]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    console.log('🔌 connectWebSocket() called');
    
    // Don't connect if component is unmounting
    if (isUnmountingRef.current) {
      console.log('⚠️ Component is unmounting, skipping WebSocket connection');
      return;
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('⏳ WebSocket connection already in progress, skipping...');
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
        // Only update state once - minimize re-renders
        if (!hasConnectedRef.current) {
          setIsConnected(true);
        }
        setIsConnecting(false);
        hasConnectedRef.current = true;
        isConnectingRef.current = false;
        hasAttemptedConnectionRef.current = false;
        
        // Setup heartbeat (no state updates)
        if (!heartbeatIntervalRef.current) {
          heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        }
        
        // Music will start automatically when session ID is received
        console.log('⏳ Waiting for session ID to start music...');
      };

      ws.onmessage = async (event) => {
        console.log('📨 WebSocket message received:', {
          isBlob: event.data instanceof Blob,
          type: event.data instanceof Blob ? 'Blob' : typeof event.data,
          size: event.data instanceof Blob ? event.data.size : event.data.length || 'N/A'
        });
        
        if (event.data instanceof Blob) {
          // Audio data
          console.log('🔊 Processing audio blob...');
          await handleAudioData(event.data);
        } else {
          // JSON message
          try {
            const data = JSON.parse(event.data);
            console.log('📋 JSON message:', data);
            handleJsonMessage(data);
          } catch (e) {
            console.error('❌ Failed to parse JSON message:', e, event.data);
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

  // Reset auto-play flag when stream changes
  useEffect(() => {
    hasAutoPlayedRef.current = false;
    console.log('🔄 Reset auto-play flag for new stream');
  }, [streamId]);

  // WebSocket connection will happen AFTER video starts - not on mount
  // (Auto-connect useEffect removed - connection happens after video plays)
  
  // Cleanup on unmount only - no re-renders while connected
  useEffect(() => {
    // Set unmounting flag to false on mount
    isUnmountingRef.current = false;
    
    return () => {
      console.log('🧹 Component unmounting - cleaning up...');
      // Set flag to prevent new connections during cleanup
      isUnmountingRef.current = true;
      
      // Close WebSocket on unmount
      if (wsRef.current) {
        try {
          console.log('🔌 Closing WebSocket on unmount');
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close(1000, 'Component unmounting');
          }
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
        wsRef.current = null;
      }
      
      // Cleanup heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore errors during cleanup
        });
        audioContextRef.current = null;
      }
      
      // Reset all refs
      isConnectingRef.current = false;
      hasConnectedRef.current = false;
      hasAutoPlayedRef.current = false;
      sessionIdRef.current = null;
      isGeneratingRef.current = false;
    };
  }, []); // Only run cleanup on unmount - no dependencies to prevent re-renders

  if (!stream) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-light text-[#2c2414]">Stream not found</p>
          <p className="mt-2 text-sm font-light text-[#6b5842]">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  const handleStart = useCallback(async () => {
    const currentSessionId = sessionIdRef.current || sessionId;
    console.log('🎵 handleStart called', { sessionId: currentSessionId, hasWs: !!wsRef.current, wsState: wsRef.current?.readyState });
    
    if (!currentSessionId || !wsRef.current) {
      console.warn('❌ Cannot start music: missing session ID or WebSocket connection');
      return false;
    }

    try {
      const currentSessionId = sessionIdRef.current || sessionId;
      console.log('🚀 Starting music generation...', { video_url: youtubeUrl, session_id: currentSessionId });
      setIsGenerating(true);

      const response = await fetch(`${API_BASE}/api/music/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: youtubeUrl,
          session_id: sessionIdRef.current || sessionId
        })
      });

      console.log('📡 Music start response:', { status: response.status, ok: response.ok });

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
        
        console.error(`❌ Failed to start music: ${response.status} ${response.statusText}`, errorText);
        
        // Check if it's a timeout error
        const isTimeout = errorText.includes('timeout') || errorText.includes('timed out');
        
        if (isTimeout) {
          console.warn('⚠️ Music generation timed out - this may be due to service availability. The video will continue playing.');
        }
        
        setIsGenerating(false);
        return false;
      }

      const result = await response.json();
      console.log('✅ Music start result:', result);

      if (result.success) {
        console.log('🎉 Music generation started successfully');
        console.log(`📹 Video: ${result.video_info?.title || 'Unknown'}`);
        console.log(`⏱️ Duration: ${result.video_info?.duration || 'N/A'}s, Live: ${result.video_info?.is_live || false}`);
        
        const startTimestamp = Date.now();
        isGeneratingRef.current = true;
        
        // Reset buffering state (matches index.html - reset for new session)
        isBufferingRef.current = true;
        bufferedDurationRef.current = 0;
        nextPlayTimeRef.current = 0;
        chunkCountRef.current = 0;
        totalBytesRef.current = 0;
        updateStats(0, 0);
        console.log('🔄 Reset all counters and buffering state');
        
        // Only update state once - minimize re-renders when WS connected
        setIsGenerating(true);
        
        // Mark that we've started playing immediately when music starts (not delayed)
        // This ensures the blocking timers start right away
        hasStartedPlayingRef.current = startTimestamp;
        console.log('✅ hasStartedPlayingRef set to:', startTimestamp);
        
        return true;
      } else {
        console.error('❌ Music start returned success=false:', result);
        setIsGenerating(false);
        return false;
      }
    } catch (error) {
      console.error('❌ Error starting music:', error);
      setIsGenerating(false);
      return false;
    }
  }, [youtubeUrl, updateStats]); // Removed sessionId from deps - use ref instead

  const handleStop = useCallback(async () => {
    const currentSessionId = sessionIdRef.current || sessionId;
    if (!currentSessionId) {
      console.warn('⚠️ Cannot stop: no session ID');
      return;
    }

    try {
      console.log('🛑 Stopping music generation...');
      
      const response = await fetch(`${API_BASE}/api/music/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current || sessionId
        })
      });

      const result = await response.json();
      console.log('🛑 Stop result:', result);

      if (result.success) {
        console.log('✅ Music stopped');
        isGeneratingRef.current = false;
        setIsGenerating(false);
        
        // Reset audio playback state (matches index.html)
        nextPlayTimeRef.current = 0;
        chunkCountRef.current = 0;
        totalBytesRef.current = 0;
        isBufferingRef.current = true;
        bufferedDurationRef.current = 0;
        updateStats(0, 0);
        console.log('🔄 Reset all audio state');
      }
    } catch (error) {
      console.error('❌ Error stopping music:', error);
    }
  }, [updateStats]); // Removed sessionId from deps - use ref instead

  const handleDownload = async () => {
    const currentSessionId = sessionIdRef.current || sessionId;
    if (!currentSessionId) {
      console.error('❌ No active session to download');
      return;
    }

    try {
      console.log('📥 Preparing download...');

      const response = await fetch(`${API_BASE}/api/music/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get the WAV file as a blob
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'gemini_music.wav';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const sizeKB = (blob.size / 1024).toFixed(2);
      console.log(`✅ Downloaded ${filename} (${sizeKB} KB)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error downloading audio: ${errorMessage}`);
    }
  };

  const handleSendPrompt = () => {
    const currentSessionId = sessionIdRef.current || sessionId;
    const promptText = userPrompt.trim();
    
    if (!promptText) {
      console.warn('⚠️ Cannot send empty prompt');
      return;
    }
    
    if (!currentSessionId) {
      console.warn('⚠️ Cannot send prompt: no session ID');
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot send prompt: WebSocket not connected');
      return;
    }

    try {
      console.log(`📝 Sending prompt: "${promptText}"`);
      
      // Send via WebSocket (matches index.html exactly)
      wsRef.current.send(JSON.stringify({
        type: 'prompt',
        prompt: promptText
      }));
      
      console.log('✅ Prompt sent via WebSocket - will be remembered in context');
      setUserPrompt("");
    } catch (error) {
      console.error('❌ Error sending prompt:', error);
    }
  };

  // Handle play button - controls both YouTube video and music generation
  const handlePlay = useCallback(async () => {
    console.log('▶️ Play button clicked');
    
    if (!youtubePlayerRef.current) {
      console.warn('⚠️ YouTube player not ready');
      return;
    }

    // Start YouTube video (decoupled from WebSocket)
    try {
      youtubePlayerRef.current.playVideo();
      console.log('✅ YouTube video started');
      
      // Connect WebSocket if not already connected (music will auto-start when session ID arrives)
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        if (!isUnmountingRef.current) {
          console.log('🔌 Connecting WebSocket after play button...');
          connectWebSocket();
        }
      } else if (wsRef.current.readyState === WebSocket.OPEN && sessionIdRef.current && !isGeneratingRef.current) {
        // Already connected with session - start music immediately
        setTimeout(async () => {
          if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current && !isGeneratingRef.current) {
            try {
              await handleStart();
            } catch (error) {
              console.error('❌ Failed to start music generation:', error);
            }
          }
        }, 200);
      }
    } catch (error) {
      console.error('❌ Error playing YouTube video:', error);
    }
  }, [connectWebSocket, handleStart]);

  // Handle pause button - controls both YouTube video and music generation
  const handlePause = useCallback(async () => {
    console.log('⏸️ Pause button clicked');
    
    if (!youtubePlayerRef.current) {
      console.warn('⚠️ YouTube player not ready');
      return;
    }

    // Pause YouTube video
    try {
      youtubePlayerRef.current.pauseVideo();
      console.log('✅ YouTube video paused');
    } catch (error) {
      console.error('❌ Error pausing YouTube video:', error);
    }

    // Stop music generation if generating (check ref to avoid re-render)
    if (isGeneratingRef.current && sessionIdRef.current) {
      console.log('🛑 Stopping music generation...');
      handleStop().catch((error) => {
        console.error('❌ Failed to stop music generation:', error);
      });
    }
  }, [handleStop]);

  // Handle YouTube player ready
  const handleYouTubeReady = useCallback((player: any) => {
    youtubePlayerRef.current = player;
    // Video is automatically muted by the YouTubePlayer component
    console.log('✅ YouTube player ready');
    
    // Auto-play when player is ready - WebSocket connects AFTER video starts
    if (!hasAutoPlayedRef.current) {
      console.log('🚀 Attempting auto-play - player ready');
      setTimeout(() => {
        if (youtubePlayerRef.current && !hasAutoPlayedRef.current) {
          try {
            youtubePlayerRef.current.playVideo();
            hasAutoPlayedRef.current = true;
            console.log('✅ Auto-played YouTube video');
            
            // Connect WebSocket AFTER video starts playing (music will auto-start when session ID arrives)
            setTimeout(() => {
              if (!isUnmountingRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                console.log('🔌 Connecting WebSocket after video started...');
                connectWebSocket();
              }
            }, 1000); // Connect 1 second after video starts
          } catch (error) {
            console.error('❌ Auto-play error:', error);
          }
        }
      }, 800); // Longer delay to ensure player is fully ready
    }
  }, [connectWebSocket]);
  
  // Handle YouTube player state changes - disabled (no auto-start from YouTube controls)
  const handleYouTubeStateChange = useCallback((event: any) => {
    // YouTube controls are disabled, so this should only fire from programmatic changes
    const state = event.data;
    console.log('📺 YouTube state changed (programmatic):', { 
      state, 
      stateName: state === 1 ? 'PLAYING' : state === 2 ? 'PAUSED' : state === 5 ? 'CUED' : state
    });
  }, []);

  // Scrubbing removed - no-op handler
  const handleYouTubeSeek = useCallback((seconds: number) => {
    // Scrubbing integration removed
  }, []);

  // Format bytes to match index.html (always in KB)
  const formatBytes = (bytes: number) => {
    // Match index.html: always show in KB
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Golden Waves Background */}
      <div className="golden-waves-container">
        <div className="golden-wave golden-wave-1"></div>
        <div className="golden-wave golden-wave-2"></div>
        <div className="golden-wave golden-wave-3"></div>
        <div className="golden-wave-thin golden-wave-thin-1"></div>
        <div className="golden-wave-thin golden-wave-thin-2"></div>
      </div>
      <div className="relative mx-auto h-full max-w-[95vw] px-6 pt-24 pb-6 sm:px-8 lg:px-12 z-10">
        {/* Top Bar - Back, Title */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/discover">
            <Button variant="ghost" size="sm" className="h-8 text-[#6b5842] hover:text-[#CBB994] hover:bg-transparent px-3 text-sm font-light">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              <span>Back</span>
            </Button>
          </Link>
          
          {sessionId && (
            <Badge variant="outline" className="text-xs font-light text-[#6b5842] border-[#e7e5e4] bg-white/70 px-3 py-1">
              ID: {sessionId}
            </Badge>
          )}
        </div>

        {/* Stream Info */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-[#2c2414] truncate">{stream.title}</h1>
            {stream.isLive && (
              <Badge className="bg-red-600 text-white text-xs font-light px-3 py-1 border-0">
                <span className="relative mr-1.5 flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                LIVE
              </Badge>
            )}
            {/* Connection Status - Inline with LIVE */}
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
              isConnected 
                ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                : isConnecting
                ? "bg-[#CBB994]/20 text-[#CBB994] border border-[#CBB994]/50"
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
            {/* Author and Viewers - Right side */}
            <div className="ml-auto flex items-center gap-3 text-sm font-light text-[#6b5842]">
              <span>{stream.author}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{stream.viewers.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 h-[calc(100vh-120px)]">
          {/* Main Content - Video and Controls */}
          <div className="lg:col-span-4 flex flex-col gap-2 min-h-0">

            {/* Video Display - Main Focus */}
            <Card className="luxury-card overflow-hidden flex-[0.88] min-h-0 border-[#e7e5e4]">
              <CardContent className="p-0 h-full">
                <div className="relative w-full h-full overflow-hidden bg-black">
                  {videoId ? (
                    <>
                      <YouTubePlayer
                        videoId={videoId}
                        isLive={stream.isLive}
                        onReady={handleYouTubeReady}
                        onStateChange={handleYouTubeStateChange}
                      />
                      {/* Loading overlay when connecting */}
                      {isConnecting && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-12 w-12 text-[#CBB994] animate-spin mb-4" />
                            <p className="text-white text-lg font-light">Connecting to server...</p>
                            <p className="text-white/80 text-sm mt-2 font-light">Please wait</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Music2 className="mx-auto h-12 w-12 text-[#CBB994]/50 mb-2" />
                        <p className="text-gray-400 text-sm mb-1">Invalid YouTube URL</p>
                        <p className="text-xs text-gray-600">{youtubeUrl}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prompt Box */}
            <Card className="luxury-card">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendPrompt()}
                    placeholder="Music prompt (optional)..."
                      className="h-10 text-sm font-light bg-white/70 border-[#e7e5e4] text-[#2c2414] placeholder:text-[#a8a29e] focus:bg-white focus:border-[#CBB994]/30"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                      className="text-[#6b5842] hover:text-[#CBB994] hover:bg-transparent"
                    onClick={handleSendPrompt}
                    disabled={!isConnected || !sessionId}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Stats and Additional Controls */}
          <div className="lg:col-span-1 flex flex-col gap-2 min-h-0 overflow-y-auto">
            {/* Control Buttons */}
            <Card className="luxury-card">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handlePlay}
                    disabled={!isConnected || !sessionId || isGenerating}
                    size="sm"
                    className="h-9 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-xs px-3 text-white font-light border-0"
                    title="Play"
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    Play
                  </Button>
                  <Button
                    onClick={handlePause}
                    disabled={!isConnected || !sessionId}
                    size="sm"
                    className="h-9 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs px-3 text-white font-light border-0"
                    title="Pause"
                  >
                    <Pause className="mr-1.5 h-4 w-4" />
                    Pause
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    onClick={connectWebSocket}
                    disabled={isConnected}
                    size="sm"
                      className="h-8 bg-[#CBB994] hover:bg-[#B4A582] disabled:opacity-50 text-xs px-3 text-white font-light shadow-sm border-0"
                    title="Connect"
                  >
                    <Wifi className="mr-1 h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <Button
                    onClick={handleDownload}
                    variant="ghost"
                    size="sm"
                    className="h-9 text-[#6b5842] hover:text-[#CBB994] hover:bg-transparent text-xs px-3 font-light border border-[#e7e5e4]"
                    title="Download"
                    disabled={!sessionId}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <Card className="luxury-card">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardDescription className="text-xs font-light text-[#6b5842]">Audio Chunks</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-3xl font-light text-[#2c2414]">
                    {audioChunks}
                  </div>
                </CardContent>
              </Card>
              <Card className="luxury-card">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardDescription className="text-xs font-light text-[#6b5842]">Data Received</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-3xl font-light text-[#2c2414]">
                    {formatBytes(dataReceived)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stream Details */}
            <Card className="luxury-card">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardDescription className="text-xs font-light text-[#6b5842] uppercase tracking-wide">Details</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4 space-y-3">
                <p className="text-sm font-light text-[#6b5842] leading-relaxed line-clamp-3">
                  {stream.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {stream.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-light bg-[#fafaf9] text-[#6b5842] border border-[#e7e5e4] px-2.5 py-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="pt-3 border-t border-[#e7e5e4]">
                  <Input
                    type="url"
                    value={youtubeUrl}
                    readOnly
                    className="h-8 text-xs font-light border-[#e7e5e4] bg-[#fafaf9] text-[#6b5842]"
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
