'use client';

import { useState, useRef, useEffect } from 'react';
import AudioVisualizer from './AudioVisualizer';
import LogDisplay from './LogDisplay';
import StatsDisplay from './StatsDisplay';

export default function LiveDemo() {
  const [ws, setWs] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState({ text: '⚫ Disconnected from server', state: 'disconnected' });
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=z9Ug-3qhrwY');
  const [userPrompt, setUserPrompt] = useState('');
  const [seekOffset, setSeekOffset] = useState('');
  const [logs, setLogs] = useState([{ message: 'Ready to connect...', type: 'info', time: new Date() }]);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isBufferingRef = useRef(true);
  const bufferedDurationRef = useRef(0);
  const visualizerRef = useRef(null);

  const bufferTargetSeconds = 1.5;

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date() }]);
  };

  const updateStatus = (text, state) => {
    setStatus({ text, state });
  };

  const handleAudioData = async (blob) => {
    setChunkCount(prev => prev + 1);
    setTotalBytes(prev => prev + blob.size);

    addLog(`Audio chunk received: ${blob.size} bytes`, 'audio');

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      addLog('Audio context initialized', 'success');
      isBufferingRef.current = true;
      bufferedDurationRef.current = 0;
      nextPlayTimeRef.current = 0;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pcmData = new Int16Array(arrayBuffer);
      const sampleRate = 48000;
      const numChannels = 2;
      const numFrames = pcmData.length / numChannels;

      const audioBuffer = audioContextRef.current.createBuffer(numChannels, numFrames, sampleRate);

      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < numFrames; i++) {
          channelData[i] = pcmData[i * numChannels + channel] / 32768.0;
        }
      }

      const chunkDuration = audioBuffer.duration;

      if (isBufferingRef.current) {
        bufferedDurationRef.current += chunkDuration;
        addLog(`Buffering... ${bufferedDurationRef.current.toFixed(2)}s / ${bufferTargetSeconds}s`, 'info');

        if (bufferedDurationRef.current >= bufferTargetSeconds || chunkCount >= 3) {
          isBufferingRef.current = false;
          nextPlayTimeRef.current = audioContextRef.current.currentTime + 0.1;
          addLog(`Buffer ready! Starting playback with ${bufferedDurationRef.current.toFixed(2)}s buffered`, 'success');
          updateStatus('🎵 Playing - Audio buffered and streaming', 'playing');
        }
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      if (!isBufferingRef.current) {
        const currentTime = audioContextRef.current.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;
        addLog(`Playing ${numFrames} frames (${chunkDuration.toFixed(2)}s) at ${startTime.toFixed(2)}s`, 'audio');
      } else {
        const startTime = nextPlayTimeRef.current || (audioContextRef.current.currentTime + 0.1);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;
      }

      if (visualizerRef.current) {
        visualizerRef.current.visualize(audioBuffer);
      }

      const bufferHealth = nextPlayTimeRef.current - audioContextRef.current.currentTime;
      if (bufferHealth < 0.5 && !isBufferingRef.current) {
        addLog(`⚠️ Buffer running low: ${bufferHealth.toFixed(2)}s`, 'error');
      } else if (!isBufferingRef.current) {
        addLog(`Buffer health: ${bufferHealth.toFixed(2)}s ahead`, 'info');
      }
    } catch (error) {
      addLog(`Audio processing error: ${error.message}`, 'error');
    }
  };

  const handleJsonMessage = (data) => {
    addLog(`Received: ${data.type}`, 'info');

    if (data.type === 'session') {
      setSessionId(data.session_id);
      addLog(`Session ID: ${data.session_id}`, 'success');
    } else if (data.type === 'prompt_received') {
      addLog(`Prompt applied: "${data.prompt}"`, 'success');
    } else if (data.type === 'seek_confirmed') {
      addLog(`✅ Seek confirmed: Jumped to ${data.offset}s`, 'success');
      if (data.result) {
        addLog(`   Old: ${data.result.old_offset}s → New: ${data.result.new_offset}s`, 'info');
      }
    }
  };

  const connect = () => {
    try {
      addLog('Connecting to WebSocket server...', 'info');
      updateStatus('⚡ Connecting...', 'disconnected');

      const websocket = new WebSocket('ws://localhost:3001/ws');

      websocket.onopen = () => {
        addLog('WebSocket connected!', 'success');
        updateStatus('✅ Connected to server', 'connected');
        setIsConnected(true);
      };

      websocket.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          handleAudioData(event.data);
        } else {
          const data = JSON.parse(event.data);
          handleJsonMessage(data);
        }
      };

      websocket.onerror = (error) => {
        addLog(`WebSocket error: ${error}`, 'error');
        updateStatus('❌ Connection error', 'disconnected');
      };

      websocket.onclose = () => {
        addLog('WebSocket disconnected', 'info');
        updateStatus('⚫ Disconnected from server', 'disconnected');
        setIsConnected(false);
        setIsPlaying(false);
        setSessionId(null);
      };

      setWs(websocket);
    } catch (error) {
      addLog(`Connection failed: ${error.message}`, 'error');
      updateStatus('❌ Connection failed', 'disconnected');
    }
  };

  const startMusic = async () => {
    if (!videoUrl.trim()) {
      addLog('Please enter a YouTube URL', 'error');
      return;
    }

    if (!sessionId) {
      addLog('Not connected to server', 'error');
      return;
    }

    try {
      addLog(`Starting music for: ${videoUrl}`, 'info');
      updateStatus('🎵 Starting music generation...', 'playing');

      const response = await fetch('http://localhost:3001/api/music/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, session_id: sessionId })
      });

      const result = await response.json();

      if (result.success) {
        addLog(`Music started! Video: ${result.video_info.title}`, 'success');
        addLog(`Duration: ${result.video_info.duration}s, Live: ${result.video_info.is_live}`, 'info');
        updateStatus('🎵 Buffering audio...', 'playing');
        setIsPlaying(true);
        isBufferingRef.current = true;
        bufferedDurationRef.current = 0;
        nextPlayTimeRef.current = 0;
      } else {
        addLog('Failed to start music', 'error');
        updateStatus('❌ Failed to start', 'connected');
      }
    } catch (error) {
      addLog(`Error starting music: ${error.message}`, 'error');
      updateStatus('❌ Error', 'connected');
    }
  };

  const stopMusic = async () => {
    if (!sessionId) return;

    try {
      addLog('Stopping music generation...', 'info');

      const response = await fetch('http://localhost:3001/api/music/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });

      const result = await response.json();

      if (result.success) {
        addLog('Music stopped', 'success');
        updateStatus('✅ Connected to server', 'connected');
        setIsPlaying(false);
        nextPlayTimeRef.current = 0;
        setChunkCount(0);
        setTotalBytes(0);
        isBufferingRef.current = true;
        bufferedDurationRef.current = 0;
      }
    } catch (error) {
      addLog(`Error stopping music: ${error.message}`, 'error');
    }
  };

  const sendPrompt = () => {
    if (!userPrompt.trim()) {
      addLog('Please enter a prompt', 'error');
      return;
    }

    if (!sessionId) {
      addLog('Not connected to server', 'error');
      return;
    }

    try {
      addLog(`Sending prompt: "${userPrompt}"`, 'info');
      ws.send(JSON.stringify({ type: 'prompt', prompt: userPrompt }));
      setUserPrompt('');
      addLog('Prompt sent via WebSocket', 'success');
    } catch (error) {
      addLog(`Error sending prompt: ${error.message}`, 'error');
    }
  };

  const sendSeek = () => {
    if (!seekOffset.trim()) {
      addLog('Please enter a time offset (in seconds)', 'error');
      return;
    }

    const offset = parseFloat(seekOffset);

    if (isNaN(offset) || offset < 0) {
      addLog('Please enter a valid positive number', 'error');
      return;
    }

    if (!sessionId) {
      addLog('Not connected to server', 'error');
      return;
    }

    try {
      addLog(`🎯 Simulating video seek to ${offset}s`, 'info');
      ws.send(JSON.stringify({ type: 'seek', offset }));
      setSeekOffset('');
      addLog(`Seek request sent: ${offset}s`, 'success');
    } catch (error) {
      addLog(`Error sending seek: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [ws]);

  const getStatusClasses = () => {
    const base = 'px-6 py-4 rounded-2xl mb-8 text-center text-sm font-medium backdrop-blur-xl transition-all duration-[400ms] border';
    
    if (status.state === 'disconnected') {
      return `${base} bg-rose-500/15 text-rose-500 border-rose-500/30`;
    } else if (status.state === 'connected') {
      return `${base} bg-green-500/15 text-green-500 border-green-500/30`;
    } else {
      return `${base} bg-cyan-500/15 text-cyan-500 border-cyan-500/30 animate-pulse-custom`;
    }
  };

  return (
    <div className="relative z-10 px-10 md:px-40">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-[40px] border border-white/10 rounded-[30px] p-8 md:p-16 my-20 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-center mb-10 tracking-wide">
            Live Demo
          </h2>

          <div className={getStatusClasses()}>
            {status.text}
          </div>

          <div className="bg-black/30 backdrop-blur-xl px-5 py-4 rounded-xl text-xs text-white/50 mb-8 break-all font-mono border border-white/10 text-center">
            Session ID: {sessionId || 'Not connected'}
          </div>

          <div className="mb-6">
            <label className="block mb-3 text-white/80 font-medium text-sm tracking-wide">
              YouTube Video URL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && startMusic()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-5 py-4 border border-white/15 rounded-xl text-sm bg-white/5 text-white transition-all duration-300 placeholder:text-white/40 focus:outline-none focus:border-cyan-500/60 focus:bg-white/8 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.15)]"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <button
              onClick={connect}
              disabled={isConnected}
              className="flex-1 px-7 py-4 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide relative overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-[0_4px_16px_rgba(6,182,212,0.3)] hover:shadow-[0_8px_24px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              Connect to Server
            </button>
            <button
              onClick={startMusic}
              disabled={!isConnected || isPlaying}
              className="flex-1 px-7 py-4 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide relative overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-[0_4px_16px_rgba(6,182,212,0.3)] hover:shadow-[0_8px_24px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              Start Music
            </button>
            <button
              onClick={stopMusic}
              disabled={!isPlaying}
              className="flex-1 px-7 py-4 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide relative overflow-hidden bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-[0_4px_16px_rgba(236,72,153,0.3)] hover:shadow-[0_8px_24px_rgba(236,72,153,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              Stop
            </button>
          </div>

          <div className="mb-6">
            <label className="block mb-3 text-white/80 font-medium text-sm tracking-wide">
              User Prompt (optional)
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendPrompt()}
              placeholder="e.g., make it more epic, add heavy drums..."
              className="w-full px-5 py-4 border border-white/15 rounded-xl text-sm bg-white/5 text-white transition-all duration-300 placeholder:text-white/40 focus:outline-none focus:border-cyan-500/60 focus:bg-white/8 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.15)]"
            />
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={sendPrompt}
              disabled={!isPlaying}
              className="flex-1 px-7 py-4 border border-white/20 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide bg-white/10 text-white hover:bg-white/15 hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed">
              Send Prompt
            </button>
          </div>

          <div className="mb-6">
            <label className="block mb-3 text-white/80 font-medium text-sm tracking-wide">
              🎯 Test Video Scrubbing (seconds)
            </label>
            <input
              type="text"
              value={seekOffset}
              onChange={(e) => setSeekOffset(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendSeek()}
              placeholder="e.g., 120 (jump to 2:00)"
              className="w-full px-5 py-4 border border-white/15 rounded-xl text-sm bg-white/5 text-white transition-all duration-300 placeholder:text-white/40 focus:outline-none focus:border-cyan-500/60 focus:bg-white/8 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.15)]"
            />
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={sendSeek}
              disabled={!isPlaying}
              className="flex-1 px-7 py-4 border border-white/20 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide bg-white/10 text-white hover:bg-white/15 hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed">
              Simulate Seek
            </button>
          </div>

          <AudioVisualizer ref={visualizerRef} />
          <LogDisplay logs={logs} />
          <StatsDisplay chunkCount={chunkCount} totalBytes={totalBytes} />
        </div>
      </div>
    </div>
  );
}