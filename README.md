# Gemini Video Music Showcase

Real-time AI music generation synchronized with video playback using Google's Gemini (vision) and Lyria (music generation) APIs.

## Overview

This application analyzes video content in real-time and generates adaptive music that responds to visual changes. It's the **world's first live video-to-music generator** that works with YouTube videos, livestreams, and uploaded files—creating custom soundtracks as content unfolds in real time.

### What Makes This Special?

**Livestream Support**: Unlike traditional music generation that works in post-production with unlimited time, this system generates music for **never-before-seen content** as it happens live. Whether it's a Twitch stream, YouTube premiere, or live event, the AI composes original music in real-time, adapting to visual changes as they occur.

**User-Guided Composition**: Viewers can shape the music with natural language prompts like "Add a violin," "Make it sound like Hans Zimmer," or "Switch to EDM." These preferences persist across the entire session, creating a personalized soundtrack experience.

### Key Features

- **Sub-2-second cold start** using pre-warmed Lyria connections
- **Livestream support** for real-time music generation on never-before-seen content
- **Real-time synchronization** between video playback and music generation
- **Video scrubbing support** for seamless seeking on recorded content
- **Adaptive composition** that evolves with visual content
- **Natural language control** with persistent user prompts
- **Infinite streaming** via WebSocket-based Lyria RealTime connection

## Quick Start

### Prerequisites

- Python 3.12+
- Google Gemini API key ([get one here](https://ai.google.dev/))

### Installation

1. **Clone and setup environment:**
   ```bash
   git clone https://github.com/emw8105/gemini-showcase.git
   cd gemini-showcase
   ```

2. **Configure API key:**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Install dependencies:**
   ```bash
   cd server
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```

5. **Open the frontend:**
   ```bash
   cd ../frontend
   # Open index.html in your browser
   ```

## Critical Dependencies

### yt-dlp Version Requirement

⚠️ **CRITICAL**: Requires `yt-dlp >= 2025.10.22` for reliable YouTube video processing.

YouTube frequently updates their signature algorithms. Outdated yt-dlp versions will fail with `403 Forbidden` errors.

**Symptoms of outdated yt-dlp:**
- `ERROR: unable to download video data: HTTP Error 403: Forbidden`
- `nsig extraction failed`
- Works for some videos but not others

**Check your version:**
```bash
python -c "import yt_dlp; print(yt_dlp.version.__version__)"
```

**Force upgrade if needed:**
```bash
pip install -U yt-dlp
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Video Input  │  │ Audio Player │  │ Seek Control │      │
│  └──────┬───────┘  └──────▲───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          │             WebSocket               │
          │                  │                  │
┌─────────▼──────────────────┼──────────────────▼──────────────┐
│                    Backend (FastAPI)                          │
│  ┌───────────────────────────────────────────────────┐       │
│  │         MusicGenerationOrchestrator               │       │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │       │
│  │  │ Lyria Pool  │  │ Frame Extract│  │ Gemini  │ │       │
│  │  │ (Pre-warmed)│  │ (yt-dlp)     │  │ Analyze │ │       │
│  │  └─────────────┘  └──────────────┘  └─────────┘ │       │
│  └───────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

### Processing Pipeline

1. **Cold Start (<2s)**
   - Acquire pre-warmed Lyria connection from pool
   - Analyze video metadata (title, description)
   - Start music generation with metadata-based prompt

2. **Frame Processing** (Adaptive strategy based on content type)
   
   **For Recorded Videos:**
   - Extract frames every 10 seconds of video time
   - Process 5 seconds ahead of playback for synchronization
   - Gemini analyzes visual changes between frames
   - Update Lyria prompt when significant changes detected
   
   **For Livestreams:**
   - Capture periodic snapshots from live feed
   - Detect significant visual changes in real-time
   - Generate music for never-before-seen content as it happens
   - No playback synchronization needed—music adapts to stream

3. **Audio Streaming**
   - Lyria generates 4-second audio chunks continuously
   - Stream directly to frontend via WebSocket
   - Buffer maintains uninterrupted playback
   - Infinite generation—stream runs as long as video plays

## Playback Synchronization

The system uses different strategies for recorded videos vs. livestreams:

### Recorded Videos: Playback-Synchronized Processing

For recorded content, frame processing is scheduled to align with video playback position.

```python
# Configuration
first_frame_offset = 10   # First frame at 10s mark
frame_interval = 10        # Process frames every 10s
processing_buffer = 5      # Start processing 5s before frame time
```

**Timeline Example:**

| Frame | Video Time | Processing Starts | Real-time Delta |
|-------|-----------|------------------|-----------------|
| 1     | 10s       | 5s (10-5)        | +1-2s          |
| 2     | 20s       | 15s (20-5)       | +1-2s          |
| 3     | 30s       | 25s (30-5)       | +1-2s          |

**Key Benefits:**
- Music ready 1-2 seconds after video reaches that point
- Consistent timing throughout playback
- No frame skipping or rush processing
- Scrubbing support for instant seeking

### Livestreams: Real-Time Adaptive Processing

For livestreams, the system captures the current frame at regular intervals and adapts music to what's happening *right now*.

```python
# Configuration
livestream_interval = 5  # Capture snapshot every 5 seconds
```

**How It Works:**
1. **Capture current frame** from live feed (no offset needed)
2. **Detect significant changes** using visual comparison
3. **Analyze with Gemini** when scene changes detected
4. **Update music prompt** to match new visual context
5. **Repeat continuously** for infinite real-time generation

**Why This Matters:**
Unlike recorded videos where content is known in advance, **livestreams present never-before-seen content**. The AI must analyze and compose music for scenes that don't exist yet, making this true real-time adaptive music generation.

**Example Use Cases:**
- Live sports events (music adapts to game intensity)
- Twitch gaming streams (music matches gameplay action)
- Live concerts (AI generates complementary ambient music)
- Breaking news (music reflects story tone and urgency)

### Example Logs

**Recorded Video Processing:**
```
[Orchestrator] 🎬 Video playback started at 04:34:14.645
[Orchestrator] Frame schedule: First frame at 10s, then every 10s
[Orchestrator] Processing buffer: 5s before each frame's video time

[Orchestrator] ⏸️  Waiting 2.1s before processing frame at 10s
[Orchestrator] ⏱️  Frame 1 extracted in 3.2s (playback: 10s / 1824s)
[Orchestrator] 📊 Real-time: 11.3s | Video time: 10s | Delta: +1.3s

[Orchestrator] ⏸️  Waiting 3.5s before processing frame at 20s
[Orchestrator] 📊 Real-time: 21.1s | Video time: 20s | Delta: +1.1s
```

**Livestream Processing:**
```
[Orchestrator] Starting livestream processing for session abc123
[Orchestrator] Analyzing initial livestream frame
[Orchestrator] Initial frame analysis complete

[Orchestrator] Significant change detected in livestream
[Orchestrator] Querying Gemini for frame delta analysis...
[Orchestrator] Received analysis from Gemini (needs_change=True)
[Orchestrator] Updated Lyria prompt for livestream
```

## Video Scrubbing API

For **recorded videos**, users can seek/scrub to any position and the backend immediately adapts to the new timeline.

**Note:** Scrubbing is not applicable to livestreams, as they represent real-time content without a seekable timeline.

### REST API

**Endpoint:** `POST /api/music/seek`

**Request:**
```json
{
  "session_id": "43b8a2bc-761f-4f25-9a03-f916a119978a",
  "offset": 120.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playback offset updated to 120.5s",
  "old_offset": 35.0,
  "new_offset": 120.5
}
```

### WebSocket API

**Client → Server:**
```json
{
  "type": "seek",
  "offset": 120.5
}
```

**Server → Client:**
```json
{
  "type": "seek_confirmed",
  "offset": 120.5,
  "result": {
    "success": true,
    "message": "Playback offset updated to 120.5s",
    "old_offset": 35.0,
    "new_offset": 120.5
  }
}
```

### Frontend Integration

```javascript
// WebSocket connection
const ws = new WebSocket('ws://localhost:3001/ws');

// Video player element
const videoPlayer = document.getElementById('video');
let seekTimeout = null;

// Handle video seeking with debounce
videoPlayer.addEventListener('seeked', () => {
  clearTimeout(seekTimeout);
  seekTimeout = setTimeout(() => {
    const newTime = videoPlayer.currentTime;
    
    // Send seek update via WebSocket
    ws.send(JSON.stringify({
      type: 'seek',
      offset: newTime
    }));
    
    console.log(`🎯 Seeking to ${newTime}s`);
  }, 500); // 500ms debounce to prevent spam
});

// Listen for confirmation
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'seek_confirmed') {
    console.log('✅ Seek confirmed:', data.offset);
  }
};
```

### How Scrubbing Works

When user seeks from 35s → 500s:

1. **Frontend detects seek event**
2. **Send to backend via WebSocket**
3. **Backend adjusts timeline:**
   ```python
   playback_offset = 500s
   playback_start_time = now() - 500s  # Back-date timeline
   ```
4. **Next frame calculated:**
   ```
   Next frame: 510s (500 + 10)
   Scheduled at: 505s (510 - 5 buffer)
   Wait time: ~5s (not 493s!)
   ```
5. **Old audio continues playing** while new frames process

**Key Insight:** Timeline is "back-dated" by the offset amount, so `real_time_elapsed` immediately reflects the new video position.

## Performance Characteristics

### Timing Breakdown

| Operation | Time | Notes |
|-----------|------|-------|
| Cold start | ~3s | Pre-warmed Lyria connection |
| First audio | ~6s | Metadata analysis + generation |
| Frame extraction | 3-5s | At 720p via yt-dlp |
| Gemini analysis | 2-3s | Vision API latency |
| Lyria generation | 8-10s | Per 4-second audio chunk |

### Sync Performance

- **Target delta:** +1s to +2s (near real-time)
- **Actual delta:** Consistently +0.8s to +4.9s
- **Scrub recovery:** Immediate (5s buffer still applies)

### Bottlenecks

1. **Lyria generation:** 8-10s for 4s audio (unavoidable API latency)
2. **Frame extraction:** 3-5s at 720p (acceptable)
3. **Gemini analysis:** 2-3s (API latency)

**Note:** The 5-second processing buffer accounts for these timings to ensure music is ready before video reaches that point.

## API Reference

### Start Music Generation

**WebSocket:** Connect to `ws://localhost:3001/ws`

**Send:**
```json
{
  "type": "start",
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Receive:**
- `{"type": "session", "session_id": "..."}`
- `{"type": "status", "message": "..."}`
- Binary audio data (raw PCM, 24kHz, mono, 16-bit)

### User Prompts

**WebSocket:**
```json
{
  "type": "prompt",
  "prompt": "Make it more upbeat and add piano"
}
```

**REST:**
```bash
POST /api/music/prompt
{
  "session_id": "...",
  "prompt": "Make it more upbeat and add piano"
}
```

User prompts **persist** across all future music updates. Max 5 prompts in rolling window.

### Stop Music

**WebSocket:**
```json
{
  "type": "stop"
}
```

**REST:**
```bash
POST /api/music/stop
{
  "session_id": "..."
}
```

## Session Logging

All sessions are logged to `server/logs/` with detailed timing information:

```
[2025-10-30 04:34:14] === Session Started ===
Session ID: 34d48fa7-5b91-4680-bf28-7b33cc37d4ef
Video: Studio Ghibli Movies Are An Artform

[2025-10-30 04:34:20] Frame Analysis (10s) - Initial Analysis
Scene: Pastoral landscape with rolling hills...
Composition notes: Start with gentle, whimsical melody...

[2025-10-30 04:34:28] Prompt Update
New prompt: [Gentle whimsical melody, orchestral strings, peaceful...]

[2025-10-30 04:34:35] Event
User scrubbed: 30s → 500s

[2025-10-30 04:34:40] Frame Analysis (500s) - Delta Analysis
Scene change: Dramatic shift to action sequence...
```

## Configuration

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your_api_key_here

# Optional
SERVER_PORT=3001
LYRIA_POOL_SIZE=3
FRAME_RESOLUTION=720p
LOG_LEVEL=INFO
```

### Tuning Parameters

**In `orchestrator.py`:**

```python
# Recorded video processing timing
first_frame_offset = 10   # First frame video time (seconds)
frame_interval = 10        # Frame interval (seconds)
processing_buffer = 5      # Processing buffer (seconds)

# Livestream processing timing
livestream_interval = 5    # Snapshot interval for live content (seconds)
```

**Recommendations:**
- **For recorded videos:**
  - Increase `processing_buffer` (e.g., 7s) if analysis is slow
  - Decrease `first_frame_offset` (e.g., 5s) to analyze earlier
  - Increase `frame_interval` (e.g., 15s) for long videos
  
- **For livestreams:**
  - Decrease `livestream_interval` (e.g., 3s) for faster-paced content
  - Increase `livestream_interval` (e.g., 10s) for slower-paced streams
  - Balance between responsiveness and API quota usage

## Troubleshooting

### yt-dlp 403 Errors

**Problem:** `ERROR: unable to download video data: HTTP Error 403: Forbidden`

**Solution:**
```bash
pip install -U yt-dlp
```

YouTube changes their APIs frequently. Always use the latest yt-dlp.

### Audio Not Playing

**Check:**
1. Browser console for WebSocket errors
2. Audio context initialized (requires user interaction first)
3. Backend logs for Lyria connection issues

### Seek/Scrubbing Not Working

**Verify:**
1. WebSocket connection established
2. Session ID set correctly
3. Backend logs show: `"🎯 Playback offset updated"`
4. Timeline adjusted (not just "reset")

### Slow Processing / Large Delta

**Adjust buffer:**
```python
processing_buffer = 7  # Increase from 5 to 7
```

**Or reduce frame frequency:**
```python
frame_interval = 15  # Increase from 10 to 15
```

## Production Deployment

### Recommendations

1. **yt-dlp updates:** Automate monthly updates
   ```bash
   pip install -U yt-dlp
   ```

2. **Monitor YouTube API changes:** Subscribe to [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases)

3. **Error handling:** Implement retry logic for transient API failures

4. **Rate limiting:** Add rate limits to prevent API quota exhaustion

5. **Session cleanup:** Implement automatic cleanup of old session logs

6. **Health checks:** Monitor Lyria pool health and connection status

### Environment Setup

```bash
# Production environment
export GEMINI_API_KEY=your_production_key
export SERVER_PORT=443
export LOG_LEVEL=WARNING
export LYRIA_POOL_SIZE=5
```

## Future Enhancements

### Planned Features

- [ ] **Smart seek detection:** Differentiate large jumps (>30s) vs small scrubs (<5s)
- [ ] **Buffer clearing:** Clear Lyria buffer on large jumps for faster adaptation
- [ ] **Chapter support:** Pre-process frames at chapter markers
- [ ] **Predictive pre-loading:** Analyze common seek patterns
- [ ] **Multi-video queue:** Support playlist playback
- [ ] **Export feature:** Save generated music to file

### Ideas

- Detect video chapters and pre-generate music for instant transitions
- Analyze user seek patterns and pre-load likely positions
- Support multiple audio styles (cinematic, ambient, electronic, etc.)
- Real-time collaboration (multiple users controlling same session)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- **Google Gemini** for vision analysis API
- **Google Lyria** for music generation API
- **yt-dlp** for reliable YouTube video processing

---

For questions or issues, please [open an issue](https://github.com/emw8105/gemini-showcase/issues).
