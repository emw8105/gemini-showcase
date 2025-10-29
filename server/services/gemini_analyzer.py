"""
GeminiAnalyzer - Scene analysis using Gemini 2.0 Flash

Analyzes video frames to generate composition notes for Lyria.
Uses context-aware prompting to prevent redundant suggestions.
"""

import base64
import os
from typing import Dict, Tuple
from google.cloud import aiplatform
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Image
import textwrap
from composition_context import CompositionContext


class GeminiAnalyzer:
    """Analyzes video frames using Gemini vision capabilities."""
    
    def __init__(
        self,
        project_id: str = None,
        location: str = None,
        model_name: str = None,
        temperature: float = None
    ):
        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = location or os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        self.temperature = temperature or float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
        
        # Check if Google Cloud project is configured
        if not self.project_id:
            print("\n" + "=" * 60)
            print("WARNING: Google Cloud project not configured")
            print("=" * 60)
            print("GeminiAnalyzer requires a Google Cloud project for video")
            print("frame analysis. The server will continue without it.")
            print("\nTo enable, add to .env file:")
            print("   GOOGLE_CLOUD_PROJECT=your-project-id")
            print("\nOptionally, for service account auth:")
            print("   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json")
            print("=" * 60 + "\n")
            self.model = None
            return
        
        # Initialize Vertex AI
        # Will use Application Default Credentials (gcloud auth) or service account
        try:
            vertexai.init(project=self.project_id, location=self.location)
            self.model = GenerativeModel(self.model_name)
            
            credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if credentials_path:
                print(f"[GeminiAnalyzer] ✓ Initialized with service account auth")
            else:
                print(f"[GeminiAnalyzer] ✓ Initialized with Application Default Credentials (gcloud)")
            print(f"[GeminiAnalyzer]   Project: {self.project_id}, Model: {self.model_name}")
            
        except Exception as e:
            print("\n" + "=" * 60)
            print("ERROR: Failed to initialize Vertex AI")
            print("=" * 60)
            print(f"Error: {str(e)}")
            print("\nPossible solutions:")
            print("1. Run: gcloud auth application-default login")
            print("2. Or set GOOGLE_APPLICATION_CREDENTIALS in .env")
            print("3. Ensure Vertex AI API is enabled in your project")
            print("=" * 60 + "\n")
            self.model = None
    
    async def analyze_frame(
        self, 
        frame_bytes: bytes, 
        composition_context: CompositionContext
    ) -> Dict[str, str]:
        """Analyze a single frame for initial composition."""
        if not self.model:
            raise RuntimeError(
                "GeminiAnalyzer is not initialized. Please configure Google Cloud credentials in .env:\n"
                "  GOOGLE_CLOUD_PROJECT=your-project-id\n"
                "  GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json"
            )
        
        try:
            # Describe the image first
            description = await self.describe_image(frame_bytes)
            
            # Generate composition notes using context
            prompt = composition_context.generate_gemini_prompt(description)
            
            # Create image part
            image_part = Part.from_data(data=frame_bytes, mime_type="image/png")
            
            response = self.model.generate_content(
                [image_part, prompt],
                generation_config={
                    "temperature": self.temperature,
                    "max_output_tokens": 256,
                }
            )
            
            composition_notes = response.text.strip()
            
            print(f"[GeminiAnalyzer] Generated composition notes: {composition_notes}")
            
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
            image_part = Part.from_data(data=frame_bytes, mime_type="image/png")
            
            prompt = "Describe this video frame in 2-3 sentences. Focus on the mood, setting, action, and visual atmosphere."
            
            response = self.model.generate_content(
                [image_part, prompt],
                generation_config={
                    "temperature": self.temperature,
                    "max_output_tokens": 128,
                }
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
        Only returns composition notes if there's a significant change.
        """
        try:
            old_image = Part.from_data(data=old_frame_bytes, mime_type="image/png")
            new_image = Part.from_data(data=new_frame_bytes, mime_type="image/png")
            
            prompt = textwrap.dedent(f"""\
                You are analyzing two consecutive frames from a video to determine if the music should change.

                Video title: "{composition_context.video_title}"

                Current musical state:
                - Mood: {composition_context.current_state['mood']}
                - Tempo: {composition_context.current_state['tempo']}
                - Intensity: {composition_context.current_state['intensity']}

                Compare these two frames and answer:
                1. What changed between them? (scene, action, mood)
                2. Should the music change? (yes/no)
                3. If yes, what specific composition updates are needed? (2–3 sentences max)

                If the change is minor or the music is already appropriate, say "no change needed".

                Analysis:
            """)

            response = self.model.generate_content(
                [old_image, "Frame 1 (previous)", new_image, "Frame 2 (current)", prompt],
                generation_config={
                    "temperature": self.temperature,
                    "max_output_tokens": 256,
                }
            )
            
            analysis = response.text.strip()
            
            print(f"[GeminiAnalyzer] Frame delta analysis: {analysis}")
            
            # Check if change is needed
            lower_analysis = analysis.lower()
            needs_change = not any(phrase in lower_analysis for phrase in [
                'no change needed',
                "shouldn't change",
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
            image_part = Part.from_data(data=frame_bytes, mime_type="image/png")
            
            prompt = f"""Quick musical assessment for livestream.
Video: "{composition_context.video_title}"
Current: {composition_context.current_state['mood']} mood, {composition_context.current_state['tempo']} tempo

In 1-2 sentences, describe what composition adjustments (if any) this scene needs:"""

            response = self.model.generate_content(
                [image_part, prompt],
                generation_config={
                    "temperature": 0.5,
                    "max_output_tokens": 128,
                }
            )
            
            notes = response.text.strip()
            
            return {
                "composition_notes": notes,
                "timestamp": datetime.now().timestamp()
            }
            
        except Exception as e:
            print(f"[GeminiAnalyzer] Error in quick analysis: {e}")
            raise


from datetime import datetime
