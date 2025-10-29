"""
FrameExtractor - Intelligent video frame sampling

Extracts frames from YouTube videos with different strategies:
- Livestreams: Periodic snapshots of current playback
- Recorded videos: Offset-based sampling throughout video

Includes frame-diff comparison to avoid redundant analysis.
"""

import cv2
import numpy as np
from PIL import Image
import io
import os
import tempfile
import subprocess
import imageio_ffmpeg
import yt_dlp
from typing import Optional, List, Tuple
from datetime import datetime
from skimage.metrics import structural_similarity as ssim


def resolve_ffmpeg_path() -> str:
    """Return the ffmpeg executable from imageio-ffmpeg (pip-provided)."""
    exepath = imageio_ffmpeg.get_ffmpeg_exe()
    if not exepath or not os.path.exists(exepath):
        raise RuntimeError("ffmpeg not available from imageio-ffmpeg; run 'pip install imageio-ffmpeg'.")
    return exepath


class FrameExtractor:
    """Extracts and compares video frames from YouTube content."""
    
    def __init__(
        self,
        frame_diff_threshold: float = None,
        frame_interval: int = None,
        livestream_interval: int = None
    ):
        self.frame_diff_threshold = frame_diff_threshold or float(
            os.getenv("FRAME_DIFF_THRESHOLD", "0.20")
        )
        self.frame_interval = frame_interval or int(
            os.getenv("FRAME_INTERVAL_SECONDS", "5")
        )
        self.livestream_interval = livestream_interval or int(
            os.getenv("LIVESTREAM_SNAPSHOT_INTERVAL", "5")
        )
        
        self.last_frame: Optional[np.ndarray] = None
        self.temp_dir = tempfile.mkdtemp(prefix="gemini_showcase_")
        
        # Create screenshots directory for saving processed frames
        self.screenshots_dir = os.path.join(os.getcwd(), "screenshots")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        
        # Get FFmpeg from imageio-ffmpeg package
        self.ffmpeg_path = resolve_ffmpeg_path()
        
        print(f"[FrameExtractor] Initialized with temp directory: {self.temp_dir}")
        print(f"[FrameExtractor] Screenshots will be saved to: {self.screenshots_dir}")
        print(f"[FrameExtractor] Using FFmpeg: {self.ffmpeg_path}")
    
    async def initialize(self):
        """Initialize frame extractor."""
        os.makedirs(self.temp_dir, exist_ok=True)
        print(f"[FrameExtractor] Ready to extract frames")
    
    async def extract_frame(self, video_url: str, timestamp_seconds: float = 0) -> bytes:
        """Extract a single frame from a YouTube video at a specific timestamp using FFmpeg."""
        try:
            print(f"[FrameExtractor] Extracting frame from {video_url} at {timestamp_seconds}s")
            
            # Get direct video URL using yt-dlp
            ydl_opts = {
                'format': 'best[ext=mp4]/best',
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                video_stream_url = info['url']
            
            # Use FFmpeg to extract frame at specific timestamp
            output_path = os.path.join(self.temp_dir, f"frame_{int(timestamp_seconds)}.png")
            
            # FFmpeg command to extract a single frame
            cmd = [
                self.ffmpeg_path,
                '-ss', str(timestamp_seconds),  # Seek to timestamp
                '-i', video_stream_url,          # Input URL
                '-vframes', '1',                 # Extract 1 frame
                '-f', 'image2',                  # Output as image
                '-y',                            # Overwrite output file
                output_path
            ]
            
            # Run FFmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                raise Exception(f"FFmpeg error: {result.stderr}")
            
            # Read the extracted frame
            if not os.path.exists(output_path):
                raise Exception("Frame file not created")
            
            with open(output_path, 'rb') as f:
                frame_bytes = f.read()
            
            # Clean up
            os.remove(output_path)
            
            # Save screenshot for showcase
            await self._save_screenshot(frame_bytes, f"recorded_{int(timestamp_seconds)}s", video_url)
            
            return frame_bytes
            
        except Exception as e:
            print(f"[FrameExtractor] Error extracting frame: {e}")
            raise
    
    async def extract_livestream_frame(self, video_url: str) -> bytes:
        """Extract frame from a livestream (current timestamp) using FFmpeg."""
        try:
            print(f"[FrameExtractor] Extracting current frame from livestream: {video_url}")
            
            # Get livestream URL
            ydl_opts = {
                'format': 'best[ext=mp4]/best',
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                video_stream_url = info['url']
            
            # Use FFmpeg to capture current frame from livestream
            output_path = os.path.join(self.temp_dir, f"livestream_frame_{int(datetime.now().timestamp())}.png")
            
            cmd = [
                self.ffmpeg_path,
                '-i', video_stream_url,
                '-vframes', '1',
                '-f', 'image2',
                '-y',
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                raise Exception(f"FFmpeg error: {result.stderr}")
            
            if not os.path.exists(output_path):
                raise Exception("Frame file not created")
            
            with open(output_path, 'rb') as f:
                frame_bytes = f.read()
            
            os.remove(output_path)
            
            # Save screenshot for showcase (livestream frames are unique!)
            await self._save_screenshot(frame_bytes, f"livestream_{int(datetime.now().timestamp())}", video_url)
            
            return frame_bytes
            
        except Exception as e:
            print(f"[FrameExtractor] Error extracting livestream frame: {e}")
            raise
    
    def _frame_to_bytes(self, frame: np.ndarray) -> bytes:
        """Convert OpenCV frame to PNG bytes."""
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Convert to PIL Image
        pil_image = Image.fromarray(frame_rgb)
        
        # Save to bytes
        byte_io = io.BytesIO()
        pil_image.save(byte_io, format='PNG')
        byte_io.seek(0)
        
        return byte_io.read()
    
    def _bytes_to_frame(self, frame_bytes: bytes) -> np.ndarray:
        """Convert PNG bytes to OpenCV frame."""
        pil_image = Image.open(io.BytesIO(frame_bytes))
        frame = np.array(pil_image)
        
        # Convert RGB to BGR for OpenCV
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        
        return frame
    
    async def _save_screenshot(self, frame_bytes: bytes, frame_id: str, video_url: str):
        """Save frame to screenshots directory for showcase."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{frame_id}.png"
            filepath = os.path.join(self.screenshots_dir, filename)
            
            # Save the frame
            with open(filepath, 'wb') as f:
                f.write(frame_bytes)
            
            print(f"[FrameExtractor] Screenshot saved: {filename}")
            
        except Exception as e:
            print(f"[FrameExtractor] Error saving screenshot: {e}")
    
    async def compare_frames(self, frame1_bytes: bytes, frame2_bytes: bytes) -> float:
        """
        Compare two frames and return difference percentage.
        Returns a value between 0 (identical) and 1 (completely different).
        """
        try:
            # Convert to OpenCV frames
            frame1 = self._bytes_to_frame(frame1_bytes)
            frame2 = self._bytes_to_frame(frame2_bytes)
            
            # Resize to standard size for faster comparison
            width, height = 320, 240
            frame1_resized = cv2.resize(frame1, (width, height))
            frame2_resized = cv2.resize(frame2, (width, height))
            
            # Convert to grayscale
            gray1 = cv2.cvtColor(frame1_resized, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frame2_resized, cv2.COLOR_BGR2GRAY)
            
            # Calculate structural similarity
            similarity_score = ssim(gray1, gray2)
            
            # Convert to difference (0 = identical, 1 = completely different)
            difference = 1 - similarity_score
            
            print(f"[FrameExtractor] Frame difference: {difference * 100:.2f}%")
            
            return difference
            
        except Exception as e:
            print(f"[FrameExtractor] Error comparing frames: {e}")
            # If comparison fails, assume frames are different
            return 1.0
    
    async def is_significant_change(self, new_frame_bytes: bytes) -> bool:
        """Check if a new frame is significantly different from the last frame."""
        if self.last_frame is None:
            self.last_frame = new_frame_bytes
            return True
        
        difference = await self.compare_frames(self.last_frame, new_frame_bytes)
        
        if difference > self.frame_diff_threshold:
            self.last_frame = new_frame_bytes
            return True
        
        return False
    
    async def get_video_info(self, video_url: str) -> dict:
        """Get video info (duration, title, is_live)."""
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                return {
                    "title": info.get('title', ''),
                    "duration": info.get('duration', 0),
                    "is_live": info.get('is_live', False),
                    "author": info.get('uploader', ''),
                    "view_count": info.get('view_count', 0),
                    "thumbnail": info.get('thumbnail', '')
                }
                
        except Exception as e:
            print(f"[FrameExtractor] Error getting video info: {e}")
            raise
    
    def calculate_frame_timestamps(self, duration_seconds: int, num_frames: int = 10) -> List[int]:
        """
        Calculate frame timestamps for a recorded video.
        Returns an array of timestamps to sample throughout the video.
        """
        timestamps = []
        interval = duration_seconds / (num_frames + 1)
        
        for i in range(1, num_frames + 1):
            timestamps.append(int(interval * i))
        
        return timestamps
    
    async def cleanup(self):
        """Clean up resources."""
        try:
            # Clean up temp directory
            if os.path.exists(self.temp_dir):
                for file in os.listdir(self.temp_dir):
                    os.remove(os.path.join(self.temp_dir, file))
                os.rmdir(self.temp_dir)
            print("[FrameExtractor] Cleanup complete")
        except Exception as e:
            print(f"[FrameExtractor] Cleanup error: {e}")
    
    def reset(self):
        """Reset frame comparison state."""
        self.last_frame = None
