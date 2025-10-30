"""
LyriaConnectionPool - Maintains warm WebSocket connections to Lyria RealTime API

Uses direct WebSocket connection to Lyria RealTime music generation endpoint.
Connections are pre-established but don't call play() until needed.
"""

import asyncio
import os
import json
import base64
from typing import Dict, Optional, Callable
from datetime import datetime
import websockets
from websockets.client import WebSocketClientProtocol
import re


def sanitize_prompt_for_lyria(prompt: str) -> str:
    """
    Remove copyrighted content references from prompts to avoid Lyria filtering.
    
    Lyria will reject prompts mentioning:
    - Specific song titles
    - Artist names  
    - Video titles
    - Copyrighted material
    
    We keep only the musical descriptors (mood, genre, instruments, tempo, etc.)
    """
    # Remove common patterns that trigger filtering
    patterns_to_remove = [
        r'titled\s+"[^"]+"',  # titled "Song Name"
        r'titled\s+\'[^\']+\'',  # titled 'Song Name'
        r'video\s+titled[^.]+\.',  # video titled X.
        r'for\s+a\s+video\s+titled[^.]+\.',  # for a video titled X.
        r'Music for:\s+[^.]+\.',  # Music for: X.
        r'Current:\s+',  # Current: (keep the content after)
        r'Scene update:\s+',  # Scene update: (keep the content after)
    ]
    
    sanitized = prompt
    for pattern in patterns_to_remove:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
    
    # Clean up extra whitespace
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    
    # If we stripped too much, provide a generic fallback
    if len(sanitized) < 10:
        return "ambient instrumental background music"
    
    return sanitized


class LyriaConnection:
    """Represents a single Lyria Live Music API connection."""
    
    def __init__(self, connection_id: str, api_key: str):
        self.id = connection_id
        self.api_key = api_key
        self.ws: Optional[WebSocketClientProtocol] = None
        self.status = "disconnected"
        self.is_active = False
        self.session_id: Optional[str] = None
        self.created_at = datetime.now().timestamp()
        self.on_audio_data: Optional[Callable] = None
        self._recv_task: Optional[asyncio.Task] = None
    
    async def connect(self):
        """Establish WebSocket connection to Lyria Live Music API."""
        try:
            print(f"[LyriaConnection] {self.id} connecting to Lyria...")
            
            # WebSocket URL for Lyria RealTime Music API
            ws_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key={self.api_key}"
            
            # Connect to WebSocket
            self.ws = await websockets.connect(ws_url)
            
            # Send setup message
            setup_message = {
                "setup": {
                    "model": "models/lyria-realtime-exp"
                }
            }
            await self.ws.send(json.dumps(setup_message))
            
            # Wait for setup confirmation
            response = await self.ws.recv()
            response_data = json.loads(response)
            
            if "setupComplete" in response_data:
                self.status = "ready"
                print(f"[LyriaConnection] {self.id} connected and ready")
            else:
                raise Exception(f"Unexpected setup response: {response_data}")
            
        except Exception as e:
            print(f"[LyriaConnection] {self.id} connection error: {e}")
            self.status = "error"
            raise
    
    async def _receive_audio(self):
        """Background task to receive and process audio from Lyria."""
        try:
            if not self.ws:
                return
            
            print(f"[LyriaConnection] {self.id} receive task started, waiting for messages...")
            
            async for message in self.ws:
                data = json.loads(message)
                
                # Debug: Log all messages from Lyria
                print(f"[LyriaConnection] {self.id} received message: {json.dumps(data)[:200]}")
                
                # Handle filtered prompts (content policy violations)
                if "filteredPrompt" in data:
                    filtered = data["filteredPrompt"]
                    print(f"[LyriaConnection] {self.id} prompt was filtered!")
                    print(f"[LyriaConnection] {self.id} reason: {filtered.get('filteredReason', 'unknown')}")
                    continue
                
                # Handle errors
                if "error" in data:
                    print(f"[LyriaConnection] {self.id} received error: {data.get('error')}")
                    continue
                
                # Handle audio chunks from serverContent
                if "serverContent" in data:
                    server_content = data["serverContent"]
                    
                    # Look for audioChunks (the actual audio data)
                    if "audioChunks" in server_content:
                        for chunk in server_content["audioChunks"]:
                            if "data" in chunk:
                                # Base64 encoded PCM audio
                                audio_b64 = chunk["data"]
                                audio_data = base64.b64decode(audio_b64)
                                
                                if self.on_audio_data and audio_data:
                                    print(f"[LyriaConnection] {self.id} sending {len(audio_data)} bytes of audio")
                                    await self.on_audio_data(audio_data)
                    
                    # Handle turn completion
                    if "turnComplete" in server_content:
                        print(f"[LyriaConnection] {self.id} turn complete")
                    
        except asyncio.CancelledError:
            print(f"[LyriaConnection] {self.id} receive task cancelled")
        except Exception as e:
            print(f"[LyriaConnection] {self.id} receive error: {e}")
            self.status = "error"
    
    async def start(self, initial_prompt: str, bpm: int = 120, temperature: float = 1.0):
        """Start music generation with initial prompt."""
        # Sanitize prompt to avoid filtering (remove copyrighted content references)
        sanitized_prompt = sanitize_prompt_for_lyria(initial_prompt)
        print(f"[LyriaConnection] {self.id} starting with prompt: {sanitized_prompt}")
        
        if not self.ws:
            raise RuntimeError("WebSocket not connected")
        
        self.is_active = True
        
        # Start the receive task FIRST (before sending prompt)
        self._recv_task = asyncio.create_task(self._receive_audio())
        
        # Send initial prompt using Live Music API format
        prompt_message = {
            "client_content": {
                "weightedPrompts": [
                    {
                        "text": sanitized_prompt,
                        "weight": 1.0
                    }
                ]
            }
        }
        await self.ws.send(json.dumps(prompt_message))
        
        # Send playback control to actually start generation
        control_message = {
            "playback_control": "play"
        }
        await self.ws.send(json.dumps(control_message))
        
        print(f"[LyriaConnection] {self.id} music generation started")
    
    async def update_prompt(self, new_prompt: str, weight: float = 1.0):
        """Update composition with new prompt."""
        # Sanitize prompt to avoid filtering
        sanitized_prompt = sanitize_prompt_for_lyria(new_prompt)
        print(f"[LyriaConnection] {self.id} updating prompt (length: {len(sanitized_prompt)} chars)")
        
        if not self.ws:
            raise RuntimeError("WebSocket not connected")
        
        # Send update using Live Music API format
        message = {
            "client_content": {
                "weightedPrompts": [
                    {
                        "text": sanitized_prompt,
                        "weight": weight
                    }
                ]
            }
        }
        
        await self.ws.send(json.dumps(message))
    
    async def pause(self):
        """Pause music generation."""
        print(f"[LyriaConnection] {self.id} pausing")
        
        # WebSocket API may not support pause - stopping instead
        await self.stop()
    
    async def stop(self):
        """Stop music generation."""
        print(f"[LyriaConnection] {self.id} stopping")
        self.is_active = False
        
        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
    
    async def reset_context(self):
        """Reset the music context."""
        # May need to send a specific message or reconnect
        pass
    
    async def close(self):
        """Close the connection."""
        await self.stop()
        
        if self.ws:
            try:
                await self.ws.close()
            except Exception as e:
                print(f"[LyriaConnection] {self.id} close error: {e}")
        
        self.status = "closed"


class LyriaConnectionPool:
    """Manages a pool of pre-warmed Lyria connections."""
    
    def __init__(
        self,
        pool_size: int = None,
        api_key: str = None
    ):
        self.pool_size = pool_size or int(os.getenv("LYRIA_POOL_SIZE", "3"))
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.pool: list[LyriaConnection] = []
        self.active_connections: Dict[str, LyriaConnection] = {}
        self.is_initialized = False
    
    async def initialize(self):
        """Initialize the connection pool - call this on app startup."""
        print(f"[LyriaPool] Initializing pool with {self.pool_size} connections...")
        
        # Create connections concurrently
        tasks = [
            self._create_connection(i)
            for i in range(self.pool_size)
        ]
        
        await asyncio.gather(*tasks)
        
        self.is_initialized = True
        print(f"[LyriaPool] Pool initialized with {len(self.pool)} ready connections")
    
    async def _create_connection(self, index: int) -> LyriaConnection:
        """Create a single Lyria connection."""
        try:
            connection_id = f"lyria-{index}-{int(datetime.now().timestamp())}"
            connection = LyriaConnection(connection_id, self.api_key)
            
            await connection.connect()
            self.pool.append(connection)
            
            return connection
            
        except Exception as e:
            print(f"[LyriaPool] Failed to create connection {index}: {e}")
            raise
    
    async def acquire_connection(self, session_id: str) -> LyriaConnection:
        """Get a connection from the pool - returns immediately with pre-warmed connection."""
        if not self.is_initialized:
            raise Exception("Connection pool not initialized. Call initialize() first.")
        
        # Find an available connection
        available = next(
            (conn for conn in self.pool 
             if conn.status == "ready" and not conn.is_active and not conn.session_id),
            None
        )
        
        if not available:
            print("[LyriaPool] No available connections, creating new one...")
            available = await self._create_connection(len(self.pool))
            
            # Asynchronously create a replacement for the pool
            asyncio.create_task(self._create_connection(len(self.pool)))
        
        # Mark as active and assign to session
        available.session_id = session_id
        self.active_connections[session_id] = available
        
        print(f"[LyriaPool] Assigned connection {available.id} to session {session_id}")
        print(f"[LyriaPool] Pool status: {self._count_available()}/{len(self.pool)} available")
        
        return available
    
    async def release_connection(self, session_id: str):
        """Release a connection back to the pool."""
        connection = self.active_connections.get(session_id)
        
        if not connection:
            print(f"[LyriaPool] No connection found for session {session_id}")
            return
        
        # Stop the active session
        await connection.stop()

        # Close and reconnect to clear audio buffer (prevents old audio from playing on the next session)
        print(f"[LyriaPool] Resetting connection {connection.id} to clear buffer...")
        await connection.close()
        await connection.connect()
        
        # Reset connection state
        connection.is_active = False
        connection.session_id = None
        connection.on_audio_data = None  # Clear callback
        
        del self.active_connections[session_id]
        
        print(f"[LyriaPool] Released and reset connection {connection.id}")
        print(f"[LyriaPool] Pool status: {self._count_available()}/{len(self.pool)} available")
    
    def get_connection(self, session_id: str) -> Optional[LyriaConnection]:
        """Get active connection for a session."""
        return self.active_connections.get(session_id)
    
    async def shutdown(self):
        """Shutdown the entire pool."""
        print("[LyriaPool] Shutting down connection pool...")
        
        # Stop all active connections
        for session_id, connection in self.active_connections.items():
            await connection.stop()
        
        # Close all connections
        for connection in self.pool:
            await connection.close()
        
        self.pool.clear()
        self.active_connections.clear()
        self.is_initialized = False
        
        print("[LyriaPool] Pool shutdown complete")
    
    def get_stats(self) -> dict:
        """Get pool statistics."""
        return {
            "total_connections": len(self.pool),
            "available_connections": self._count_available(),
            "active_connections": len(self.active_connections),
            "connection_statuses": [
                {
                    "id": conn.id,
                    "status": conn.status,
                    "is_active": conn.is_active,
                    "session_id": conn.session_id
                }
                for conn in self.pool
            ]
        }
    
    def _count_available(self) -> int:
        """Count available connections."""
        return sum(
            1 for conn in self.pool
            if not conn.is_active and conn.status == "ready"
        )
