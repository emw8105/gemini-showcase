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
}

export function YouTubePlayer({ 
  videoId, 
  isLive, 
  onReady, 
  onStateChange
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiReadyRef = useRef(false);

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
          controls: 0, // Disable YouTube controls - use custom buttons
          disablekb: 1, // Disable keyboard controls
          enablejsapi: 1,
          fs: 0, // Disable fullscreen
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0, // Hide video info
        },
        events: {
          onReady: (event: any) => {
            // Mute the video
            event.target.mute();
            if (onReady) {
              onReady(event.target);
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const currentTime = playerRef.current?.getCurrentTime?.();
            console.log('🎬 YouTube player state change:', {
              state,
              stateName: state === 1 ? 'PLAYING' : state === 2 ? 'PAUSED' : state === 5 ? 'CUED' : state,
              currentTime: currentTime || 'N/A'
            });
            
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

  // Seek detection removed - scrubbing integration disabled

  return <div ref={containerRef} className="w-full h-full youtube-player-container" />;
}

