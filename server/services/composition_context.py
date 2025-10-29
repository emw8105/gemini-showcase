"""
CompositionContext - Tracks musical state across frames

Prevents erratic changes by maintaining awareness of current composition.
Persists user prompts and provides context for Gemini analysis.
"""

from typing import List, Dict, Optional
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class UserPrompt:
    text: str
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())


@dataclass
class CompositionUpdate:
    analysis: str
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())


class CompositionContext:
    """Tracks and manages musical composition state across video frames."""
    
    def __init__(self, video_title: str = ""):
        self.video_title = video_title
        self.current_state = {
            "mood": "neutral",
            "tempo": "moderate",
            "intensity": "medium",
            "volume": "moderate",
            "instruments": [],
            "genre": "adaptive"
        }
        
        self.user_prompts: List[UserPrompt] = []
        self.recent_updates: List[CompositionUpdate] = []
        self.max_recent_updates = 3
        self.max_user_prompts = 5
        self.last_frame_analysis: Optional[str] = None
    
    def add_user_prompt(self, prompt: str) -> None:
        """Add a user prompt that will persist across all future composition updates."""
        self.user_prompts.append(UserPrompt(text=prompt))
        
        # Keep only last N user prompts to avoid token bloat
        if len(self.user_prompts) > self.max_user_prompts:
            self.user_prompts.pop(0)
    
    def update_from_analysis(self, analysis: str) -> None:
        """Update composition state based on Gemini analysis."""
        self.last_frame_analysis = analysis
        
        # Add to recent updates (rolling window)
        self.recent_updates.append(CompositionUpdate(analysis=analysis))
        
        if len(self.recent_updates) > self.max_recent_updates:
            self.recent_updates.pop(0)
        
        # Extract and update state from analysis
        self._extract_state_from_analysis(analysis)
    
    def _extract_state_from_analysis(self, analysis: str) -> None:
        """Extract musical attributes from analysis text."""
        lower_analysis = analysis.lower()
        
        # Update mood
        if any(word in lower_analysis for word in ['intense', 'dramatic']):
            self.current_state["mood"] = "intense"
        elif any(word in lower_analysis for word in ['calm', 'peaceful']):
            self.current_state["mood"] = "calm"
        elif any(word in lower_analysis for word in ['upbeat', 'energetic']):
            self.current_state["mood"] = "upbeat"
        elif any(word in lower_analysis for word in ['dark', 'suspenseful']):
            self.current_state["mood"] = "dark"
        
        # Update tempo
        if any(word in lower_analysis for word in ['fast', 'quick']):
            self.current_state["tempo"] = "fast"
        elif 'slow' in lower_analysis:
            self.current_state["tempo"] = "slow"
        
        # Update intensity
        if any(word in lower_analysis for word in ['building', 'crescendo']):
            self.current_state["intensity"] = "building"
        elif any(word in lower_analysis for word in ['peak', 'climax']):
            self.current_state["intensity"] = "peak"
        elif any(word in lower_analysis for word in ['fading', 'diminishing']):
            self.current_state["intensity"] = "fading"
    
    def generate_lyria_prompt(self, new_analysis: Optional[str] = None) -> str:
        """Generate a prompt for Lyria based on current context."""
        parts = []
        
        # Base context from video title
        if self.video_title:
            parts.append(f"Music for: {self.video_title}")
        
        # User preferences (highest priority)
        if self.user_prompts:
            user_prefs = ". ".join([p.text for p in self.user_prompts])
            parts.append(f"User requests: {user_prefs}")
        
        # Current state
        state = self.current_state
        parts.append(
            f"Current: {state['mood']} mood, {state['tempo']} tempo, {state['intensity']} intensity"
        )
        
        # New analysis if provided
        if new_analysis:
            parts.append(f"Scene update: {new_analysis}")
        
        return ". ".join(parts) + "."
    
    def generate_gemini_prompt(self, frame_description: str) -> str:
        """
        Generate a context-aware prompt for Gemini analysis.
        Prevents redundant suggestions (e.g., "increase volume" when already at peak).
        """
        state = self.current_state
        
        prompt = "You are analyzing a video frame to provide musical composition guidance.\n\n"
        prompt += f'Video title: "{self.video_title}"\n\n'
        
        # Provide current state
        prompt += "Current musical state:\n"
        prompt += f"- Mood: {state['mood']}\n"
        prompt += f"- Tempo: {state['tempo']}\n"
        prompt += f"- Intensity: {state['intensity']}\n"
        prompt += f"- Volume: {state['volume']}\n"
        
        # Add user preferences
        if self.user_prompts:
            prompt += "\nUser preferences (ALWAYS honor these):\n"
            for i, p in enumerate(self.user_prompts, 1):
                prompt += f"{i}. {p.text}\n"
        
        # Frame analysis request
        prompt += f"\nFrame description: {frame_description}\n\n"
        
        prompt += "Instructions:\n"
        prompt += "1. Only suggest changes if the scene significantly shifts\n"
        prompt += "2. Avoid suggesting the same mood/tempo/intensity already in place\n"
        prompt += "3. If volume/intensity is already at 'peak' or 'high', suggest alternative changes (instruments, mood shifts)\n"
        prompt += "4. Always maintain user preferences\n"
        prompt += "5. Provide concise composition notes (2-3 sentences max)\n\n"
        prompt += "Composition notes:"
        
        return prompt
    
    def get_initial_prompt(self) -> str:
        """Get initial prompt for starting Lyria (before first frame analysis)."""
        return f'Generate background music for a video titled "{self.video_title}". Start with a neutral, adaptive composition.'
    
    def reset(self, video_title: str = "") -> None:
        """Reset context for a new video."""
        self.video_title = video_title
        self.current_state = {
            "mood": "neutral",
            "tempo": "moderate",
            "intensity": "medium",
            "volume": "moderate",
            "instruments": [],
            "genre": "adaptive"
        }
        self.user_prompts = []
        self.recent_updates = []
        self.last_frame_analysis = None
    
    def get_state_summary(self) -> Dict:
        """Get a summary of current state (for debugging/logging)."""
        return {
            "video_title": self.video_title,
            "current_state": self.current_state.copy(),
            "user_prompt_count": len(self.user_prompts),
            "recent_update_count": len(self.recent_updates)
        }
