"""
GeminiAnalyzer - Scene analysis using Gemini 2.0 Flash

Analyzes video frames to generate composition notes for Lyria.
Uses context-aware prompting to prevent redundant suggestions.
Uses Google Generative AI SDK (API key) instead of Vertex AI.
"""

import os
from datetime import datetime
from typing import Dict
import google.generativeai as genai
from PIL import Image
import io
from services.composition_context import CompositionContext


class GeminiAnalyzer:
    """Analyzes video frames using Gemini vision capabilities."""
    
    def __init__(
        self,
        api_key: str = None,
        model_name: str = None,
        temperature: float = None
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        self.temperature = temperature or float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
        
        # Check if API key is configured
        if not self.api_key:
            print("\n" + "=" * 60)
            print("WARNING: Gemini API key not configured")
            print("=" * 60)
            print("GeminiAnalyzer requires a Gemini API key for video")
            print("frame analysis. The server will continue without it.")
            print("\nTo enable, add to .env file:")
            print("   GEMINI_API_KEY=your-api-key")
            print("=" * 60 + "\n")
            self.model = None
            return
        
        # Configure Gemini API
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
            print(f"[GeminiAnalyzer] Initialized with API key")
            print(f"[GeminiAnalyzer]   Model: {self.model_name}")
            
        except Exception as e:
            print("\n" + "=" * 60)
            print("ERROR: Failed to initialize Gemini API")
            print("=" * 60)
            print(f"Error: {str(e)}")
            print("\nPlease check your GEMINI_API_KEY in .env")
            print("=" * 60 + "\n")
            self.model = None
    
    def _bytes_to_image(self, frame_bytes: bytes) -> Image.Image:
        """Convert bytes to PIL Image."""
        return Image.open(io.BytesIO(frame_bytes))
    
    async def analyze_frame(
        self, 
        frame_bytes: bytes, 
        composition_context: CompositionContext
    ) -> Dict[str, str]:
        """Analyze a single frame for initial composition."""
        if not self.model:
            raise RuntimeError(
                "GeminiAnalyzer is not initialized. Please configure GEMINI_API_KEY in .env"
            )
        
        try:
            # Describe the image first
            description = await self.describe_image(frame_bytes)
            
            # Generate composition notes using context
            prompt = composition_context.generate_gemini_prompt(description)
            
            # Convert bytes to PIL Image
            image = self._bytes_to_image(frame_bytes)
            
            response = await self.model.generate_content_async(
                [image, prompt],
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=256,
                )
            )
            
            composition_notes = response.text.strip()
            
            return {
                "description": description,
                "composition_notes": composition_notes,
                "timestamp": datetime.now().timestamp()
            }
            
        except Exception as e:
            print(f"[GeminiAnalyzer] Error analyzing frame: {e}")
            raise
    
    async def describe_image(self, frame_bytes: bytes) -> str:
        """Describe an image using Gemini's vision capabilities."""
        try:
            image = self._bytes_to_image(frame_bytes)
            
            prompt = "Describe this video frame in 2-3 sentences. Focus on the mood, setting, action, and visual atmosphere."
            
            response = await self.model.generate_content_async(
                [image, prompt],
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=128,
                )
            )
            
            description = response.text.strip()
            return description
            
        except Exception as e:
            print(f"[GeminiAnalyzer] Error describing image: {e}")
            raise
    
    async def analyze_frame_delta(
        self,
        old_frame_bytes: bytes,
        new_frame_bytes: bytes,
        composition_context: CompositionContext
    ) -> Dict:
        """
        Compare two frames and analyze the differences.
        Only returns composition notes if there is a significant change.
        """
        try:
            old_image = self._bytes_to_image(old_frame_bytes)
            new_image = self._bytes_to_image(new_frame_bytes)
            
            prompt = f"""You are analyzing two consecutive frames from a video to determine if the music should change.

Video title: "{composition_context.video_title}"

Current musical state:
- Mood: {composition_context.current_state['mood']}
- Tempo: {composition_context.current_state['tempo']}
- Intensity: {composition_context.current_state['intensity']}

Compare these two frames and answer:
1. What changed between them? (scene, action, mood)
2. Should the music change? (yes/no)
3. If yes, what specific composition updates are needed? (2-3 sentences max)

If the change is minor or the music is already appropriate, say "no change needed".

Analysis:"""

            response = await self.model.generate_content_async(
                [old_image, "Frame 1 (previous)", new_image, "Frame 2 (current)", prompt],
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=256,
                )
            )
            
            analysis = response.text.strip()
            
            # Check if change is needed
            lower_analysis = analysis.lower()
            needs_change = not any(phrase in lower_analysis for phrase in [
                'no change needed',
                "should not change",
                'no updates needed'
            ])
            
            return {
                "analysis": analysis,
                "needs_change": needs_change,
                "timestamp": datetime.now().timestamp()
            }
            
        except Exception as e:
            print(f"[GeminiAnalyzer] Error analyzing frame delta: {e}")
            raise
    
    async def quick_analyze(
        self,
        frame_bytes: bytes,
        composition_context: CompositionContext
    ) -> Dict:
        """Quick analysis for livestreams (optimized for speed)."""
        try:
            image = self._bytes_to_image(frame_bytes)
            
            prompt = f"""Quick musical assessment for livestream.
Video: "{composition_context.video_title}"
Current: {composition_context.current_state['mood']} mood, {composition_context.current_state['tempo']} tempo

In 1-2 sentences, describe what composition adjustments (if any) this scene needs:"""

            response = await self.model.generate_content_async(
                [image, prompt],
                generation_config=genai.GenerationConfig(
                    temperature=0.5,
                    max_output_tokens=128,
                )
            )
            
            notes = response.text.strip()
            
            return {
                "composition_notes": notes,
                "timestamp": datetime.now().timestamp()
            }
            
        except Exception as e:
            print(f"[GeminiAnalyzer] Error in quick analysis: {e}")
            raise
