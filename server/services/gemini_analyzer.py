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
    
    def _generate_lyria_optimized_prompt(self, frame_description: str, composition_context: CompositionContext) -> str:
        """Generate a Lyria-optimized prompt that produces rich musical descriptions."""
        state = composition_context.current_state
        
        prompt = f"""You are a music director creating prompts for Lyria RealTime, an AI music generation system.

Video: "{composition_context.video_title}"
Frame: {frame_description}

Current music state:
- Mood: {state['mood']}
- Tempo: {state['tempo']}
- Intensity: {state['intensity']}

LYRIA CAPABILITIES:
Lyria responds best to rich, descriptive prompts that specify:
1. **Instruments**: Guitar, Piano, Synth Pads, Cello, Drums, Saxophone, etc.
2. **Genre**: EDM, Jazz, Classical, Rock, Ambient, Cinematic, etc.
3. **Mood/Atmosphere**: Dreamy, Energetic, Dark, Upbeat, Ethereal, Ominous, etc.
4. **Musical qualities**: Tight Groove, Rich Orchestration, Fat Beats, Ambient, Virtuoso, etc.

YOUR TASK:
Generate a concise but descriptive music prompt (2-3 sentences) that:
- Matches the scene's visual mood and energy
- Specifies concrete instruments and genre
- Uses vivid musical descriptors
- Builds on the current state smoothly (no abrupt changes)

EXAMPLES:
- "Upbeat synthpop with bright tones and spacey synths. Danceable rhythm with a tight groove."
- "Cinematic orchestral score with rich string arrangements. Emotional and building intensity."
- "Chill lo-fi hip hop featuring smooth pianos and fat beats. Dreamy ambient atmosphere."
- "Dark electronic music with ominous drone and glitchy effects. Unsettling and experimental."

Music prompt for this scene:"""
        
        return prompt
    
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
            
            # Generate composition notes using Lyria-optimized prompt
            prompt = self._generate_lyria_optimized_prompt(description, composition_context)
            
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
            
            state = composition_context.current_state
            
            prompt = f"""You are a music director analyzing scene changes for Lyria RealTime music generation.

Video: "{composition_context.video_title}"

Current music:
- Genre/Style: {state.get('genre', 'adaptive')}
- Mood: {state['mood']}
- Tempo: {state['tempo']}
- Intensity: {state['intensity']}

LYRIA MUSIC SYSTEM:
Lyria creates real-time adaptive music using rich prompts with:
- Specific instruments (Piano, Guitar, Synth Pads, Drums, Strings, etc.)
- Musical genres (Cinematic, EDM, Jazz, Ambient, Rock, etc.)
- Atmosphere descriptors (Dreamy, Energetic, Dark, Upbeat, Ethereal, etc.)
- Musical qualities (Tight Groove, Rich Orchestration, Fat Beats, etc.)

YOUR TASK:
Compare Frame 1 (previous) vs Frame 2 (current):

1. What changed in the scene? (action, mood, lighting, energy)
2. Should the music change? (yes/no)
3. If YES: Provide a Lyria-optimized music prompt (2-3 sentences) that:
   - Specifies concrete instruments and genre
   - Uses vivid musical descriptors
   - Smoothly transitions from current state
   - Matches the new scene's mood and energy

If the change is minor or music is already appropriate, say "no change needed".

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
            
            state = composition_context.current_state
            
            prompt = f"""Quick music update for livestream - Lyria RealTime system.

Video: "{composition_context.video_title}"
Current: {state['mood']} mood, {state['tempo']} tempo

Generate a concise Lyria music prompt (1-2 sentences) for this scene.
Include: instruments, genre/style, and mood descriptors.
Keep it smooth - no abrupt changes.

Music prompt:"""

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
