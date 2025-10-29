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
from typing import Dict, Optional
from datetime import datetime
from services.lyria_pool import LyriaConnectionPool, LyriaConnection
from services.composition_context import CompositionContext
from services.gemini_analyzer import GeminiAnalyzer
from services.frame_extractor import FrameExtractor


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
            print(f"[Orchestrator] Starting music generation for session {session_id}")
            
            if not self.is_initialized:
                raise Exception("Orchestrator not initialized")
            
            # Get video info
            video_info = await self.frame_extractor.get_video_info(video_url)
            print(f"[Orchestrator] Video info: {video_info}")
            
            # Create composition context
            composition_context = CompositionContext(video_info["title"])
            
            # Acquire Lyria connection from pool (pre-warmed, instant)
            lyria_connection = await self.lyria_pool.acquire_connection(session_id)
            
            # Set up audio data handler to relay to client
            async def relay_audio(audio_data):
                try:
                    await client_websocket.send_bytes(audio_data)
                except Exception as e:
                    print(f"[Orchestrator] Error relaying audio: {e}")
            
            lyria_connection.on_audio_data = relay_audio
            
            # Start Lyria immediately with title-based prompt
            initial_prompt = composition_context.get_initial_prompt()
            await lyria_connection.start(initial_prompt)
            
            print(f"[Orchestrator] Music started for session {session_id}")
            
            # Store session data
            session = {
                "session_id": session_id,
                "video_url": video_url,
                "video_info": video_info,
                "composition_context": composition_context,
                "lyria_connection": lyria_connection,
                "client_websocket": client_websocket,
                "is_live": video_info["is_live"],
                "frame_index": 0,
                "is_active": True,
                "started_at": datetime.now().timestamp()
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
        
        print(f"[Orchestrator] Starting livestream processing for {session_id}")
        
        previous_frame = None
        
        while session["is_active"]:
            try:
                # Extract current frame
                current_frame = await self.frame_extractor.extract_livestream_frame(video_url)
                
                if previous_frame:
                    # Compare frames
                    is_significant = await self.frame_extractor.is_significant_change(current_frame)
                    
                    if is_significant:
                        print(f"[Orchestrator] Significant change detected in livestream {session_id}")
                        
                        # Analyze the change
                        delta_analysis = await self.gemini_analyzer.analyze_frame_delta(
                            previous_frame,
                            current_frame,
                            composition_context
                        )
                        
                        if delta_analysis["needs_change"]:
                            # Update composition context
                            composition_context.update_from_analysis(delta_analysis["analysis"])
                            
                            # Generate and send new prompt to Lyria
                            new_prompt = composition_context.generate_lyria_prompt(delta_analysis["analysis"])
                            await lyria_connection.update_prompt(new_prompt)
                            
                            print(f"[Orchestrator] Updated Lyria prompt for {session_id}")
                else:
                    # First frame - full analysis
                    analysis = await self.gemini_analyzer.analyze_frame(current_frame, composition_context)
                    composition_context.update_from_analysis(analysis["composition_notes"])
                    
                    new_prompt = composition_context.generate_lyria_prompt(analysis["composition_notes"])
                    await lyria_connection.update_prompt(new_prompt)
                    
                    print(f"[Orchestrator] Initial frame analysis complete for {session_id}")
                
                previous_frame = current_frame
                
                # Wait before next snapshot
                await asyncio.sleep(self.frame_extractor.livestream_interval)
                
            except Exception as e:
                print(f"[Orchestrator] Error in livestream processing for {session_id}: {e}")
                await asyncio.sleep(self.frame_extractor.livestream_interval)
    
    async def _process_recorded_video(self, session: dict):
        """Process recorded video with offset-based sampling."""
        session_id = session["session_id"]
        video_url = session["video_url"]
        video_info = session["video_info"]
        composition_context = session["composition_context"]
        lyria_connection = session["lyria_connection"]
        
        print(f"[Orchestrator] Starting recorded video processing for {session_id}")
        
        # Calculate timestamps to sample
        duration = video_info["duration"]
        timestamps = self.frame_extractor.calculate_frame_timestamps(duration)
        
        print(f"[Orchestrator] Will sample {len(timestamps)} frames from {duration}s video")
        
        previous_frame = None
        
        for timestamp in timestamps:
            if not session["is_active"]:
                break
            
            try:
                # Extract frame at timestamp
                current_frame = await self.frame_extractor.extract_frame(video_url, timestamp)
                
                if previous_frame:
                    # Compare frames
                    difference = await self.frame_extractor.compare_frames(previous_frame, current_frame)
                    
                    if difference > self.frame_extractor.frame_diff_threshold:
                        print(f"[Orchestrator] Scene change detected at {timestamp}s in {session_id}")
                        
                        # Analyze the change
                        delta_analysis = await self.gemini_analyzer.analyze_frame_delta(
                            previous_frame,
                            current_frame,
                            composition_context
                        )
                        
                        if delta_analysis["needs_change"]:
                            composition_context.update_from_analysis(delta_analysis["analysis"])
                            
                            new_prompt = composition_context.generate_lyria_prompt(delta_analysis["analysis"])
                            await lyria_connection.update_prompt(new_prompt)
                            
                            print(f"[Orchestrator] Updated composition at {timestamp}s")
                else:
                    # First frame
                    analysis = await self.gemini_analyzer.analyze_frame(current_frame, composition_context)
                    composition_context.update_from_analysis(analysis["composition_notes"])
                    
                    new_prompt = composition_context.generate_lyria_prompt(analysis["composition_notes"])
                    await lyria_connection.update_prompt(new_prompt)
                    
                    print(f"[Orchestrator] Initial analysis complete for {session_id}")
                
                previous_frame = current_frame
                
                # Wait a bit before processing next frame
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"[Orchestrator] Error processing frame at {timestamp}s: {e}")
        
        print(f"[Orchestrator] Finished processing all frames for {session_id}")
    
    async def handle_user_prompt(self, session_id: str, user_prompt: str) -> dict:
        """Handle user prompt."""
        session = self.active_sessions.get(session_id)
        
        if not session:
            raise Exception(f"Session {session_id} not found")
        
        print(f'[Orchestrator] User prompt for {session_id}: "{user_prompt}"')
        
        composition_context = session["composition_context"]
        lyria_connection = session["lyria_connection"]
        
        # Add user prompt to context (persists across all future updates)
        composition_context.add_user_prompt(user_prompt)
        
        # Generate new prompt with user input
        new_prompt = composition_context.generate_lyria_prompt(user_prompt)
        await lyria_connection.update_prompt(new_prompt)
        
        print(f"[Orchestrator] User prompt applied to {session_id}")
        
        return {"success": True, "message": "Prompt applied"}
    
    async def stop_music_generation(self, session_id: str):
        """Stop music generation for a session."""
        session = self.active_sessions.get(session_id)
        
        if not session:
            print(f"[Orchestrator] Session {session_id} not found")
            return
        
        print(f"[Orchestrator] Stopping music generation for {session_id}")
        
        session["is_active"] = False
        
        # Release Lyria connection back to pool
        await self.lyria_pool.release_connection(session_id)
        
        # Clean up
        del self.active_sessions[session_id]
        self.frame_extractor.reset()
        
        print(f"[Orchestrator] Session {session_id} stopped")
    
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
