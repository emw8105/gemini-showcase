"""
SessionLogger - Per-session logging for Gemini analysis

Creates individual log files for each session to track Gemini's
frame analysis without cluttering the main server logs.
"""

import os
from datetime import datetime
from pathlib import Path


class SessionLogger:
    """Manages per-session log files for Gemini analysis."""
    
    def __init__(self, session_id: str, log_dir: str = "logs"):
        self.session_id = session_id
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"{timestamp}_{session_id}.txt"
        
        # Initialize log file
        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write(f"=== Gemini Analysis Log ===\n")
            f.write(f"Session ID: {session_id}\n")
            f.write(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 60 + "\n\n")
    
    def log_frame_analysis(self, timestamp: float, analysis_type: str, content: str):
        """Log a frame analysis result."""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n[{datetime.now().strftime('%H:%M:%S')}] Frame @ {timestamp}s - {analysis_type}\n")
            f.write("-" * 60 + "\n")
            f.write(f"{content}\n")
            f.write("-" * 60 + "\n")
    
    def log_prompt_update(self, prompt: str):
        """Log a prompt update sent to Lyria."""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n[{datetime.now().strftime('%H:%M:%S')}] Prompt Update\n")
            f.write("-" * 60 + "\n")
            f.write(f"{prompt}\n")
            f.write("-" * 60 + "\n")
    
    def log_user_prompt(self, user_prompt: str):
        """Log a user-provided prompt."""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n[{datetime.now().strftime('%H:%M:%S')}] USER PROMPT\n")
            f.write("=" * 60 + "\n")
            f.write(f"{user_prompt}\n")
            f.write("=" * 60 + "\n")
    
    def log_session_end(self):
        """Log session completion."""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n\n=== Session Ended ===\n")
            f.write(f"Ended: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    def get_log_path(self) -> str:
        """Get the path to the log file."""
        return str(self.log_file.absolute())
