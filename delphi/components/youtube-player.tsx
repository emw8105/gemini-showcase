"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  isLive: boolean;
  onReady?: (player: any) => void;
  onStateChange?: (event: any) => void;
  onSeek?: (seconds: number) => void;
}

export function YouTubePlayer({ 
  videoId, 
  isLive, 
  onReady, 
  onStateChange, 
  onSeek 
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiReadyRef = useRef(false);
  const lastTimeRef = useRef(0);
  const lastSeekCheckRef = useRef(0);
  const playbackStartTimeRef = useRef(0);
  const hasInitializedSeekDetectionRef = useRef(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        apiReadyRef.current = true;
        if (containerRef.current && videoId) {
          initializePlayer();
        }
      };
    } else if (window.YT.Player) {
      apiReadyRef.current = true;
      if (containerRef.current && videoId) {
        initializePlayer();
      }
    }

    function initializePlayer() {
      if (!apiReadyRef.current || !containerRef.current || !videoId || playerRef.current) {
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            // Mute the video
            event.target.mute();
            lastTimeRef.current = 0;
            lastSeekCheckRef.current = Date.now();
            if (onReady) {
              onReady(event.target);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 (UNSTARTED), 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING), 5 (CUED)
            const state = event.data;
            // Track when playback starts for seek detection initialization
            if (state === 1) { // PLAYING
              if (playbackStartTimeRef.current === 0) {
                playbackStartTimeRef.current = Date.now();
                hasInitializedSeekDetectionRef.current = false;
                lastTimeRef.current = 0; // Reset for new playback session
              }
            } else if (state === 2) { // PAUSED
              // Don't reset playbackStartTime - we want to track from first play
            }
            
            if (onStateChange) {
              onStateChange(event);
            }
          },
        },
      });
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('Error destroying YouTube player:', e);
        }
        playerRef.current = null;
      }
    };
  }, [videoId, onReady, onStateChange]);

  // Listen for seek events (for non-live videos)
  // Note: We use a more sophisticated approach - check for backwards jumps or large forward jumps
  useEffect(() => {
    if (!playerRef.current || isLive || !onSeek) return;

    let isPlaying = false;

    const checkSeek = setInterval(() => {
      if (!playerRef.current) return;
      
      try {
        const playerState = playerRef.current.getPlayerState();
        const currentTime = playerRef.current.getCurrentTime();
        const now = Date.now();
        
        // Track if playing
        isPlaying = playerState === 1; // PLAYING
        
        // Only check if enough time has passed
        if (now - lastSeekCheckRef.current < 500) return;
        lastSeekCheckRef.current = now;
        
        // Don't detect seeks during first 10 seconds of playback to avoid false positives
        const playbackAge = playbackStartTimeRef.current > 0 
          ? Date.now() - playbackStartTimeRef.current 
          : Infinity;
        const isEarlyPlayback = playbackAge < 10000; // First 10 seconds - completely disabled
        
        if (lastTimeRef.current > 0) {
          const diff = currentTime - lastTimeRef.current;
          const absDiff = Math.abs(diff);
          
          // Skip seek detection during early playback (first 5 seconds)
          if (isEarlyPlayback) {
            // Just update last time during early playback - don't detect any seeks
            if (isPlaying) {
              lastTimeRef.current = currentTime;
            }
            return;
          }
          
          // Detect seeks (only after initial 10 seconds):
          // 1. Backward jump (negative diff > 0.5s) - always a seek
          // 2. Large forward jump (>3s) while not playing - likely a seek
          // 3. Very large forward jump (>10s) even while playing - likely a seek
          const isBackwardSeek = diff < -0.5;
          const isForwardSeek = !isPlaying && absDiff > 3;
          const isLargeJump = absDiff > 10;
          
          if (isBackwardSeek || isForwardSeek || isLargeJump) {
            console.log(`Seek detected: ${lastTimeRef.current.toFixed(1)}s -> ${currentTime.toFixed(1)}s`);
            lastTimeRef.current = currentTime;
            onSeek(currentTime);
          } else if (isPlaying) {
            // Normal playback - update last time
            lastTimeRef.current = currentTime;
          }
        } else {
          // Initialize - set initial time but don't treat as seek
          // Wait for playback to start and settle before tracking (5 seconds now)
          if (isPlaying && !hasInitializedSeekDetectionRef.current && playbackAge > 5000) {
            lastTimeRef.current = currentTime;
            hasInitializedSeekDetectionRef.current = true;
          }
        }
      } catch (e) {
        // Player might not be ready yet
      }
    }, 500); // Check every 500ms

    return () => clearInterval(checkSeek);
  }, [isLive, onSeek]);

  return <div ref={containerRef} className="w-full h-full" />;
}

