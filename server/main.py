"""
Main FastAPI server - REST API + WebSocket

Handles:
- REST API for video selection and control
- WebSocket connections for audio streaming
- Service initialization and lifecycle
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
import os
import uvicorn
from datetime import datetime
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from services.orchestrator import MusicGenerationOrchestrator

# Load environment variables
load_dotenv()

# Store WebSocket clients
clients: Dict[str, WebSocket] = {}

# Initialize orchestrator (will be done in lifespan)
orchestrator: Optional[MusicGenerationOrchestrator] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    global orchestrator
    
    # Startup
    print("=" * 60)
    print("Gemini Lyria Showcase - Backend Server")
    print("=" * 60)
    print("\n[Server] Initializing services...")
    
    orchestrator = MusicGenerationOrchestrator()
    await orchestrator.initialize()
    
    print("[Server] Services initialized successfully\n")
    print("=" * 60)
    print("✓ Server ready")
    print("✓ WebSocket endpoint: /ws")
    print("✓ Health check: /health")
    print("=" * 60)
    print("\nReady to generate music! 🎵\n")
    
    yield
    
    # Shutdown
    print("\n[Server] Shutting down gracefully...")
    if orchestrator:
        await orchestrator.shutdown()
    print("[Server] Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Gemini Lyria Showcase API",
    description="Live dynamic music generation from video content",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Allow common development ports for Next.js and Vite
ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",  # Next.js default
    "http://localhost:3001",  # Alternative Next.js port
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================================
# Pydantic Models
# ============================================================================

class VideoInfoRequest(BaseModel):
    video_url: str


class StartMusicRequest(BaseModel):
    video_url: str
    session_id: str


class UserPromptRequest(BaseModel):
    session_id: str
    prompt: str


class SeekRequest(BaseModel):
    session_id: str
    offset: float  # New playback position in seconds


class StopMusicRequest(BaseModel):
    session_id: str


class DownloadRequest(BaseModel):
    session_id: str


# ============================================================================
# REST API Routes
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": str(datetime.now()),
        "services": {
            "orchestrator": orchestrator.is_initialized if orchestrator else False,
            "lyria_pool": orchestrator.lyria_pool.get_stats() if orchestrator else None
        }
    }


@app.post("/api/video/info")
async def get_video_info(request: VideoInfoRequest):
    """Get information about a YouTube video."""
    try:
        video_info = await orchestrator.frame_extractor.get_video_info(request.video_url)
        return {
            "success": True,
            "video_info": video_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video info: {str(e)}")


@app.post("/api/music/start")
async def start_music(request: StartMusicRequest):
    """
    Start music generation for a video.
    Client should already have WebSocket connection established.
    """
    try:
        session_id = request.session_id
        
        # Get client WebSocket
        client_ws = clients.get(session_id)
        
        if not client_ws:
            raise HTTPException(
                status_code=400,
                detail="No WebSocket connection found. Connect to /ws first."
            )
        
        # Start music generation
        result = await orchestrator.start_music_generation(
            session_id,
            request.video_url,
            client_ws
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start music generation: {str(e)}")


@app.post("/api/music/prompt")
async def add_user_prompt(request: UserPromptRequest):
    """Add a user prompt to guide the composition."""
    try:
        result = await orchestrator.handle_user_prompt(request.session_id, request.prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply prompt: {str(e)}")


@app.post("/api/music/seek")
async def seek_playback(request: SeekRequest):
    """
    Update playback offset when user scrubs/seeks in the video.
    This resets the timeline so frame processing aligns with the new position.
    """
    try:
        print(f"[API] Seek request: session={request.session_id}, offset={request.offset}s")
        result = await orchestrator.update_playback_offset(request.session_id, request.offset)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update playback offset: {str(e)}")


@app.post("/api/music/stop")
async def stop_music(request: StopMusicRequest):
    """Stop music generation for a session."""
    try:
        await orchestrator.stop_music_generation(request.session_id)
        return {
            "success": True,
            "message": "Music generation stopped"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop music generation: {str(e)}")


@app.post("/api/music/download")
async def download_audio(request: DownloadRequest):
    """
    Download all generated audio as a WAV file.
    Returns the complete audio from the session as a downloadable file.
    """
    try:
        print(f"[API] Download request for session: {request.session_id}")
        
        # Export audio as WAV
        wav_data = orchestrator.export_audio_as_wav(request.session_id)
        
        # Generate filename with session ID and timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"gemini_music_{request.session_id[:8]}_{timestamp}.wav"
        
        print(f"[API] Sending WAV file: {filename} ({len(wav_data)} bytes)")
        
        # Return WAV file with proper headers
        return Response(
            content=wav_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(wav_data))
            }
        )
        
    except Exception as e:
        print(f"[API] ❌ Download error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to download audio: {str(e)}")


@app.get("/api/session/{session_id}")
async def get_session_status(session_id: str):
    """Get the status of a session."""
    status = orchestrator.get_session_status(session_id)
    return status


# ============================================================================
# WebSocket Handler
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for audio streaming.
    Client can provide sessionId as query param, or one will be generated.
    """
    await websocket.accept()
    
    # Extract or generate session ID
    session_id = websocket.query_params.get("sessionId") or str(uuid.uuid4())
    
    print(f"[WebSocket] Client connected: {session_id}")
    
    # Store client connection
    clients[session_id] = websocket
    
    # Send session ID to client
    await websocket.send_json({
        "type": "session",
        "session_id": session_id
    })
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            
            message_type = data.get("type")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                
            elif message_type == "prompt":
                await orchestrator.handle_user_prompt(session_id, data["prompt"])
                await websocket.send_json({
                    "type": "prompt_received",
                    "prompt": data["prompt"]
                })
            
            elif message_type == "seek":
                # Handle video scrubbing/seeking
                offset = data.get("offset", 0)
                result = await orchestrator.update_playback_offset(session_id, offset)
                await websocket.send_json({
                    "type": "seek_confirmed",
                    "offset": offset,
                    "result": result
                })
                
            else:
                print(f"[WebSocket] Unknown message type: {message_type}")
                
    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: {session_id}")
        clients.pop(session_id, None)
        
        # Stop music generation if active and cleanup session
        await orchestrator.stop_music_generation(session_id)
        orchestrator.cleanup_session(session_id)
        
    except Exception as e:
        print(f"[WebSocket] Error for {session_id}: {e}")
        clients.pop(session_id, None)

if __name__ == "__main__":
    
    port = int(os.getenv("PORT", "3001"))
    print(f"Starting server on port {port} (from .env or default)")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
