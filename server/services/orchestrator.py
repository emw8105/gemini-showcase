"""
MusicGenerationOrchestrator - Coordinates the entire pipeline

Manages the flow from video selection to audio streaming:
1. Acquires pre-warmed Lyria connection
2. Starts music with title-based prompt (immediate playback)
3. Analyzes frames and updates composition
4. Handles user prompts
5. Streams audio to frontend
"""

import asyncio
from typing import Dict
from datetime import datetime
from services.lyria_pool import LyriaConnectionPool
from services.composition_context import CompositionContext
from services.gemini_analyzer import GeminiAnalyzer
from services.frame_extractor import FrameExtractor
from services.session_logger import SessionLogger


class MusicGenerationOrchestrator:
    """Orchestrates the entire music generation pipeline."""
    
    def __init__(self, config: dict = None):
        config = config or {}
        
        self.lyria_pool = LyriaConnectionPool()
        self.gemini_analyzer = GeminiAnalyzer()
        self.frame_extractor = FrameExtractor()
        
        self.active_sessions: Dict[str, dict] = {}
        self.is_initialized = False
    
    async def initialize(self):
        """Initialize all services."""
        print("[Orchestrator] Initializing services...")
        
        await asyncio.gather(
            self.lyria_pool.initialize(),
            self.frame_extractor.initialize()
        )
        
        self.is_initialized = True
        print("[Orchestrator] All services initialized")
    
    async def start_music_generation(
        self,
        session_id: str,
        video_url: str,
        client_websocket
    ) -> dict:
        """
        Start generating music for a video.
        Returns immediately after starting - processing continues in background.
        """
        try:
            start_time = datetime.now()
            print(f"[Orchestrator] ⏱️  Starting music generation for session {session_id}")
            
            if not self.is_initialized:
                raise Exception("Orchestrator not initialized")
            
            # If session already exists (user restarting), clean it up first
            if session_id in self.active_sessions:
                print(f"[Orchestrator] 🔄 Session {session_id} already exists, cleaning up old data...")
                old_session = self.active_sessions[session_id]
                
                # Stop old session if still active
                if old_session.get("is_active"):
                    await self.stop_music_generation(session_id)
                
                # Clear old session completely
                self.cleanup_session(session_id)
                print(f"[Orchestrator] ✅ Old session data cleared")
            
            # Get video info
            t0 = datetime.now()
            video_info = await self.frame_extractor.get_video_info(video_url)
            t1 = datetime.now()
            print(f"[Orchestrator] ⏱️  Video info retrieved in {(t1-t0).total_seconds():.2f}s")
            print(f"[Orchestrator] Video info: {video_info}")
            
            # Create composition context
            composition_context = CompositionContext(video_info["title"])
            
            # Create session logger
            session_logger = SessionLogger(session_id)
            print(f"[Orchestrator] Session log: {session_logger.get_log_path()}")
            
            # Acquire Lyria connection from pool (pre-warmed, instant)
            t0 = datetime.now()
            lyria_connection = await self.lyria_pool.acquire_connection(session_id)
            t1 = datetime.now()
            print(f"[Orchestrator] ⏱️  Lyria connection acquired in {(t1-t0).total_seconds():.2f}s")
            
            # Set up audio data handler to relay to client
            first_audio_received = [False]  # Track first audio chunk
            first_audio_time = [None]
            audio_chunks = []  # Store chunks for potential download
            
            async def relay_audio(audio_data):
                try:
                    if not first_audio_received[0]:
                        first_audio_received[0] = True
                        first_audio_time[0] = datetime.now()
                        elapsed = (first_audio_time[0] - start_time).total_seconds()
                        print(f"[Orchestrator] 🎵 First audio chunk received in {elapsed:.2f}s from start")
                    
                    # Store chunk for download capability
                    audio_chunks.append(audio_data)
                    
                    # Relay to client
                    await client_websocket.send_bytes(audio_data)
                except Exception as e:
                    print(f"[Orchestrator] Error relaying audio: {e}")
            
            lyria_connection.on_audio_data = relay_audio
            
            # Generate initial music prompt from video metadata (fast, text-only)
            print(f"[Orchestrator] Analyzing video metadata for initial music...")
            t0 = datetime.now()
            metadata_prompt = await self.gemini_analyzer.analyze_video_metadata(video_info)
            t1 = datetime.now()
            print(f"[Orchestrator] ⏱️  Metadata analysis completed in {(t1-t0).total_seconds():.2f}s")
            
            # Start Lyria with metadata-based prompt (unique for each video)
            t0 = datetime.now()
            initial_prompt = composition_context.get_initial_prompt(metadata_prompt)
            await lyria_connection.start(initial_prompt)
            t1 = datetime.now()
            print(f"[Orchestrator] ⏱️  Lyria started in {(t1-t0).total_seconds():.2f}s")
            
            total_startup = (t1 - start_time).total_seconds()
            print(f"[Orchestrator] ✅ Music generation ready in {total_startup:.2f}s total")
            print(f"[Orchestrator] Music started for session {session_id}")
            
            # Store session data
            session = {
                "session_id": session_id,
                "video_url": video_url,
                "video_info": video_info,
                "composition_context": composition_context,
                "lyria_connection": lyria_connection,
                "client_websocket": client_websocket,
                "session_logger": session_logger,
                "is_live": video_info["is_live"],
                "frame_index": 0,
                "is_active": True,
                "started_at": datetime.now().timestamp(),
                "audio_chunks": audio_chunks  # Store reference to audio buffer
            }
            
            self.active_sessions[session_id] = session
            
            # Start background processing
            asyncio.create_task(self._process_video_frames(session))
            
            return {
                "success": True,
                "session_id": session_id,
                "video_info": video_info,
                "message": "Music generation started"
            }
            
        except Exception as e:
            print(f"[Orchestrator] Error starting music generation: {e}")
            raise
    
    async def _process_video_frames(self, session: dict):
        """
        Process video frames in the background.
        Different strategy for livestreams vs recorded videos.
        """
        session_id = session["session_id"]
        
        try:
            if session["is_live"]:
                await self._process_livestream(session)
            else:
                await self._process_recorded_video(session)
        except Exception as e:
            print(f"[Orchestrator] Error processing frames for session {session_id}: {e}")
    
    async def _process_livestream(self, session: dict):
        """Process livestream with periodic snapshots."""
        session_id = session["session_id"]
        video_url = session["video_url"]
        composition_context = session["composition_context"]
        lyria_connection = session["lyria_connection"]
        session_logger = session["session_logger"]
        
        print(f"[Orchestrator] Starting livestream processing for {session_id}")
        
        previous_frame = None
        frame_count = 0
        
        while session["is_active"]:
            try:
                # Extract current frame
                current_frame = await self.frame_extractor.extract_livestream_frame(video_url)
                frame_count += 1
                
                if previous_frame:
                    # Compare frames
                    is_significant = await self.frame_extractor.is_significant_change(current_frame)
                    
                    if is_significant:
                        print(f"[Orchestrator] Significant change detected in livestream {session_id}")
                        print(f"[Orchestrator] Querying Gemini for frame delta analysis...")
                        
                        # Analyze the change
                        delta_analysis = await self.gemini_analyzer.analyze_frame_delta(
                            previous_frame,
                            current_frame,
                            composition_context
                        )
                        
                        # Log the analysis
                        session_logger.log_frame_analysis(frame_count, "Livestream Delta", delta_analysis["analysis"])
                        
                        print(f"[Orchestrator] Received analysis from Gemini (needs_change={delta_analysis['needs_change']})")
                        
                        if delta_analysis["needs_change"]:
                            # Update composition context
                            composition_context.update_from_analysis(delta_analysis["analysis"])
                            
                            # Generate and send new prompt to Lyria
                            new_prompt = composition_context.generate_lyria_prompt(delta_analysis["analysis"])
                            await lyria_connection.update_prompt(new_prompt)
                            
                            session_logger.log_prompt_update(new_prompt)
                            print(f"[Orchestrator] Updated Lyria prompt for {session_id}")
                else:
                    # First frame - full analysis
                    print(f"[Orchestrator] Analyzing initial livestream frame")
                    analysis = await self.gemini_analyzer.analyze_frame(current_frame, composition_context)
                    
                    # Log the analysis
                    session_logger.log_frame_analysis(frame_count, "Livestream Initial", analysis["composition_notes"])
                    
                    composition_context.update_from_analysis(analysis["composition_notes"])
                    
                    new_prompt = composition_context.generate_lyria_prompt(analysis["composition_notes"])
                    await lyria_connection.update_prompt(new_prompt)
                    
                    session_logger.log_prompt_update(new_prompt)
                    print(f"[Orchestrator] Initial frame analysis complete for {session_id}")
                
                previous_frame = current_frame
                
                # Wait before next snapshot
                await asyncio.sleep(self.frame_extractor.livestream_interval)
                
            except Exception as e:
                print(f"[Orchestrator] Error in livestream processing for {session_id}: {e}")
                await asyncio.sleep(self.frame_extractor.livestream_interval)
    
    async def _process_recorded_video(self, session: dict):
        """Process recorded video with sequential playback tracking."""
        session_id = session["session_id"]
        video_url = session["video_url"]
        video_info = session["video_info"]
        composition_context = session["composition_context"]
        lyria_connection = session["lyria_connection"]
        
        print(f"[Orchestrator] Starting recorded video processing for {session_id}")
        
        # Configuration for frame processing timing
        first_frame_offset = 10  # Process first frame for 10s mark in video (gives time for initial music)
        frame_interval = 10  # Extract frame every 10 seconds of playback
        processing_buffer = 5  # Start processing N seconds before the frame's video time
        
        duration = video_info["duration"]
        print(f"[Orchestrator] Frame schedule: First frame at {first_frame_offset}s, then every {frame_interval}s")
        print(f"[Orchestrator] Processing buffer: {processing_buffer}s before each frame's video time")
        
        previous_frame = None
        frame_count = 0
        
        # Store playback start time to track real-time alignment
        playback_start_time = datetime.now()
        session["playback_start_time"] = playback_start_time
        print(f"[Orchestrator] 🎬 Video playback started at {playback_start_time.strftime('%H:%M:%S.%f')[:-3]}")
        
        # Calculate playback offset for first frame
        playback_offset = first_frame_offset
        session["playback_offset"] = playback_offset
        
        while session["is_active"] and playback_offset < duration:
            try:
                # Calculate when we should START processing this frame
                # (processing_buffer seconds before the frame's video timestamp)
                target_processing_time = playback_offset - processing_buffer
                
                # Wait until it's time to process this frame
                real_time_elapsed = (datetime.now() - playback_start_time).total_seconds()
                wait_time = target_processing_time - real_time_elapsed
                
                if wait_time > 0:
                    print(f"[Orchestrator] ⏸️  Waiting {wait_time:.1f}s before processing frame at {playback_offset}s (scheduled for {target_processing_time:.1f}s real-time)")
                    await asyncio.sleep(wait_time)
                    
                    # Check if playback_offset was updated during the wait (user scrubbed)
                    current_offset = session["playback_offset"]
                    if current_offset != playback_offset:
                        print(f"[Orchestrator] 🔄 Offset changed during wait: {playback_offset}s → {current_offset}s, recalculating...")
                        playback_offset = current_offset
                        playback_start_time = session["playback_start_time"]
                        continue  # Skip this iteration and recalculate wait time
                
                frame_start = datetime.now()
                
                # Extract frame at current playback position
                t0 = datetime.now()
                current_frame = await self.frame_extractor.extract_frame(video_url, playback_offset)
                t1 = datetime.now()
                
                # Calculate real-time elapsed since playback started
                real_time_elapsed = (t1 - playback_start_time).total_seconds()
                time_delta = real_time_elapsed - playback_offset  # How far behind/ahead we are
                
                print(f"[Orchestrator] ⏱️  Frame {frame_count + 1} extracted in {(t1-t0).total_seconds():.2f}s (playback: {playback_offset}s / {duration}s)")
                print(f"[Orchestrator] 📊 Real-time: {real_time_elapsed:.1f}s | Video time: {playback_offset}s | Delta: {time_delta:+.1f}s")
                
                if previous_frame:
                    # Compare frames
                    t0 = datetime.now()
                    difference = await self.frame_extractor.compare_frames(previous_frame, current_frame)
                    t1 = datetime.now()
                    
                    if difference > self.frame_extractor.frame_diff_threshold:
                        print(f"[Orchestrator] Scene change detected at {playback_offset}s (diff: {difference:.1f}%)")
                        
                        # Query Gemini for analysis
                        print(f"[Orchestrator] Querying Gemini for frame delta analysis...")
                        t0 = datetime.now()
                        delta_analysis = await self.gemini_analyzer.analyze_frame_delta(
                            previous_frame,
                            current_frame,
                            composition_context
                        )
                        t1 = datetime.now()
                        print(f"[Orchestrator] ⏱️  Gemini delta analysis completed in {(t1-t0).total_seconds():.2f}s")
                        
                        # Log to session file
                        session_logger = session["session_logger"]
                        session_logger.log_frame_analysis(playback_offset, "Delta Analysis", delta_analysis["analysis"])
                        
                        print(f"[Orchestrator] Received analysis from Gemini (needs_change={delta_analysis['needs_change']})")
                        
                        if delta_analysis["needs_change"]:
                            t0 = datetime.now()
                            composition_context.update_from_analysis(delta_analysis["analysis"])
                            
                            new_prompt = composition_context.generate_lyria_prompt(delta_analysis["analysis"])
                            await lyria_connection.update_prompt(new_prompt)
                            t1 = datetime.now()
                            print(f"[Orchestrator] ⏱️  Prompt updated in {(t1-t0).total_seconds():.2f}s")
                            
                            session_logger.log_prompt_update(new_prompt)
                            print(f"[Orchestrator] Updated composition at {playback_offset}s")
                else:
                    # First frame
                    print(f"[Orchestrator] Analyzing initial frame at {playback_offset}s")
                    t0 = datetime.now()
                    analysis = await self.gemini_analyzer.analyze_frame(current_frame, composition_context)
                    t1 = datetime.now()
                    print(f"[Orchestrator] ⏱️  Initial frame analysis completed in {(t1-t0).total_seconds():.2f}s")
                    
                    # Log to session file
                    session_logger = session["session_logger"]
                    session_logger.log_frame_analysis(playback_offset, "Initial Analysis", analysis["composition_notes"])
                    
                    t0 = datetime.now()
                    composition_context.update_from_analysis(analysis["composition_notes"])
                    
                    new_prompt = composition_context.generate_lyria_prompt(analysis["composition_notes"])
                    await lyria_connection.update_prompt(new_prompt)
                    t1 = datetime.now()
                    print(f"[Orchestrator] ⏱️  Initial prompt updated in {(t1-t0).total_seconds():.2f}s")
                    
                    session_logger.log_prompt_update(new_prompt)
                    print(f"[Orchestrator] Initial analysis complete for {session_id}")
                
                previous_frame = current_frame
                
                frame_total = (datetime.now() - frame_start).total_seconds()
                print(f"[Orchestrator] ⏱️  Total time for frame {frame_count + 1}: {frame_total:.2f}s")
                
                # Check if offset was updated during frame processing (user scrubbed)
                current_offset = session["playback_offset"]
                if current_offset != playback_offset:
                    print(f"[Orchestrator] 🔄 Offset changed during processing: {playback_offset}s → {current_offset}s, jumping to new position")
                    playback_offset = current_offset
                    playback_start_time = session["playback_start_time"]  # Use new timeline
                    frame_count += 1
                    # Don't continue here - let it calculate next frame position first
                
                # Move to next playback position (unless we just jumped from a seek)
                if current_offset == playback_offset:
                    # Normal increment - no seek happened
                    playback_offset += frame_interval
                    session["playback_offset"] = playback_offset
                    frame_count += 1
                else:
                    # We just jumped from a seek, calculate next frame from new position
                    playback_offset = current_offset + frame_interval
                    session["playback_offset"] = playback_offset
                
                # No fixed sleep - we'll wait at the start of next iteration based on scheduled time
                
            except Exception as e:
                print(f"[Orchestrator] Error processing frame at {playback_offset}s: {e}")
        
        print(f"[Orchestrator] ✅ Finished processing {frame_count} frames for {session_id} (reached {playback_offset}s / {duration}s)")
    
    async def handle_user_prompt(self, session_id: str, user_prompt: str) -> dict:
        """Handle user prompt."""
        session = self.active_sessions.get(session_id)
        
        if not session:
            raise Exception(f"Session {session_id} not found")
        
        print(f'[Orchestrator] User prompt for {session_id}: "{user_prompt}"')
        
        composition_context = session["composition_context"]
        lyria_connection = session["lyria_connection"]
        session_logger = session["session_logger"]
        
        # Log user prompt
        session_logger.log_user_prompt(user_prompt)
        
        # Add user prompt to context (persists across all future updates)
        composition_context.add_user_prompt(user_prompt)
        
        # Generate new prompt with user input
        new_prompt = composition_context.generate_lyria_prompt(user_prompt)
        await lyria_connection.update_prompt(new_prompt)
        
        session_logger.log_prompt_update(new_prompt)
        print(f"[Orchestrator] User prompt applied to {session_id}")
        
        return {"success": True, "message": "Prompt applied"}
    
    async def update_playback_offset(self, session_id: str, new_offset: float) -> dict:
        """
        Update playback offset when user scrubs/seeks in the video.
        Adjusts the playback timeline so that "now" corresponds to the new offset position.
        
        Args:
            session_id: The session identifier
            new_offset: New playback position in seconds (where user scrubbed to)
        
        Returns:
            dict with success status and message
        """
        session = self.active_sessions.get(session_id)
        
        if not session:
            raise Exception(f"Session {session_id} not found")
        
        old_offset = session.get("playback_offset", 0)
        print(f"[Orchestrator] 🎯 Playback offset updated for {session_id}: {old_offset}s → {new_offset}s")
        
        # Update playback offset and adjust timeline
        # Set playback_start_time so that "now" corresponds to new_offset
        # This maintains the relationship: real_time_elapsed = video_offset
        from datetime import timedelta
        session["playback_offset"] = new_offset
        session["playback_start_time"] = datetime.now() - timedelta(seconds=new_offset)
        
        # Log the scrubbing event
        session_logger = session.get("session_logger")
        if session_logger:
            session_logger.log_event(f"User scrubbed: {old_offset}s → {new_offset}s")
        
        print(f"[Orchestrator] Timeline adjusted - frame processing will continue from {new_offset}s")
        
        return {
            "success": True,
            "message": f"Playback offset updated to {new_offset}s",
            "old_offset": old_offset,
            "new_offset": new_offset
        }
    
    def export_audio_as_wav(self, session_id: str) -> bytes:
        """
        Export all collected audio chunks as a WAV file.
        
        Args:
            session_id: The session identifier
        
        Returns:
            bytes: WAV file data ready for download
        
        Raises:
            Exception: If session not found or no audio chunks available
        """
        session = self.active_sessions.get(session_id)
        
        if not session:
            raise Exception(f"Session {session_id} not found")
        
        audio_chunks = session.get("audio_chunks", [])
        
        print(f"[Orchestrator] 💾 Session found: {session_id}")
        print(f"[Orchestrator] 💾 Audio chunks available: {len(audio_chunks)}")
        
        if not audio_chunks:
            raise Exception(f"No audio data available for session {session_id}. Music may not have started yet.")
        
        print(f"[Orchestrator] 💾 Exporting {len(audio_chunks)} audio chunks as WAV for session {session_id}")
        
        # Lyria audio format: 48kHz, stereo (2 channels), 16-bit PCM
        # This MUST match what the frontend expects (see index.html handleAudioData)
        sample_rate = 48000
        num_channels = 2
        bits_per_sample = 16
        
        # Concatenate all PCM chunks
        try:
            pcm_data = b''.join(audio_chunks)
        except Exception as e:
            print(f"[Orchestrator] ❌ Error concatenating audio chunks: {e}")
            raise Exception(f"Failed to concatenate audio chunks: {e}")
        
        # Calculate sizes
        data_size = len(pcm_data)
        file_size = data_size + 36  # 44 byte header - 8 bytes
        
        # Build WAV header
        import struct
        
        wav_header = b''
        wav_header += b'RIFF'  # ChunkID
        wav_header += struct.pack('<I', file_size)  # ChunkSize
        wav_header += b'WAVE'  # Format
        
        # fmt subchunk
        wav_header += b'fmt '  # Subchunk1ID
        wav_header += struct.pack('<I', 16)  # Subchunk1Size (16 for PCM)
        wav_header += struct.pack('<H', 1)  # AudioFormat (1 for PCM)
        wav_header += struct.pack('<H', num_channels)  # NumChannels
        wav_header += struct.pack('<I', sample_rate)  # SampleRate
        wav_header += struct.pack('<I', sample_rate * num_channels * bits_per_sample // 8)  # ByteRate
        wav_header += struct.pack('<H', num_channels * bits_per_sample // 8)  # BlockAlign
        wav_header += struct.pack('<H', bits_per_sample)  # BitsPerSample
        
        # data subchunk
        wav_header += b'data'  # Subchunk2ID
        wav_header += struct.pack('<I', data_size)  # Subchunk2Size
        
        # Combine header + PCM data
        wav_file = wav_header + pcm_data
        
        duration_seconds = data_size / (sample_rate * num_channels * bits_per_sample // 8)
        print(f"[Orchestrator] ✅ WAV export complete: {len(wav_file)} bytes, {duration_seconds:.1f}s duration")
        
        return wav_file
    
    async def stop_music_generation(self, session_id: str):
        """Stop music generation for a session."""
        session = self.active_sessions.get(session_id)
        
        if not session:
            print(f"[Orchestrator] Session {session_id} not found")
            return
        
        print(f"[Orchestrator] Stopping music generation for {session_id}")
        
        session["is_active"] = False
        
        # Log session end
        if "session_logger" in session:
            session["session_logger"].log_session_end()
        
        # Release Lyria connection back to pool
        await self.lyria_pool.release_connection(session_id)
        
        # DON'T delete the session yet - keep it around so users can download audio
        # Just mark it as stopped
        session["stopped_at"] = datetime.now().timestamp()
        
        # Note: Session will be cleaned up when client disconnects or explicitly requests cleanup
        
        self.frame_extractor.reset()
        
        print(f"[Orchestrator] Session {session_id} stopped (audio still available for download)")
    
    def cleanup_session(self, session_id: str):
        """Completely remove a session and its data."""
        if session_id in self.active_sessions:
            print(f"[Orchestrator] Cleaning up session {session_id}")
            del self.active_sessions[session_id]
    
    def get_session_status(self, session_id: str) -> dict:
        """Get session status."""
        session = self.active_sessions.get(session_id)
        
        if not session:
            return {"exists": False}
        
        return {
            "exists": True,
            "session_id": session["session_id"],
            "video_title": session["video_info"]["title"],
            "is_live": session["is_live"],
            "is_active": session["is_active"],
            "uptime": datetime.now().timestamp() - session["started_at"],
            "composition_state": session["composition_context"].get_state_summary()
        }
    
    async def shutdown(self):
        """Shutdown orchestrator."""
        print("[Orchestrator] Shutting down...")
        
        # Stop all active sessions
        for session_id, session in self.active_sessions.items():
            session["is_active"] = False
        
        # Shutdown services
        await asyncio.gather(
            self.lyria_pool.shutdown(),
            self.frame_extractor.cleanup()
        )
        
        self.active_sessions.clear()
        print("[Orchestrator] Shutdown complete")
