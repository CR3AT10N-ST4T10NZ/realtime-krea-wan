# 🎥 Krea Real-time Video Generation

Real-time AI-powered text-to-video generation with dynamic prompt rewriting using Krea's realtime diffusion technology via fal.ai.

## Overview

This app uses **fal.ai's Krea WAN-14B model** to generate videos from text prompts in real-time using WebSocket streaming. It features dynamic prompt updates during generation, allowing you to see your changes instantly.

## Features

- **Real-time Video Generation**: Text-to-video using WebSocket streaming
- **Dynamic Prompt Rewriting**: Update your prompt while video is generating
- **Adjustable Parameters**: Control video dimensions, length, and seed
- **Video Recording & Download**: Automatically records and saves generated videos
- **Terminal Aesthetic UI**: Cyberpunk/terminal-styled interface with mono font
- **Frame Buffering**: Smooth playback with adjustable FPS

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# fal.ai API Key (required)
# Get your API key from https://fal.ai/dashboard/keys
FAL_API_KEY=your_fal_api_key_here

# fal.ai App Alias (optional, defaults to krea-wan-14b)
NEXT_PUBLIC_FAL_APP_ALIAS=krea-wan-14b

# App URL for SEO (optional)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and start generating videos!

## How It Works

### Architecture

```
User Input (Prompt) → WebSocket Connection (JWT Auth)
                              ↓
                    [Krea WAN-14B Model]
                              ↓
                      MsgPack Encoded Params
                              ↓
                    Video Frames (ArrayBuffer)
                              ↓
                    Canvas Display + Recording
                              ↓
                    Downloadable WebM Video
```

### WebSocket Flow

1. **Authentication**: Fetch JWT token from `/api/fal`
2. **Connection**: Connect to `wss://fal.run/fal-ai/krea-wan-14b/ws`
3. **Ready Signal**: Wait for `{status: "ready"}` message
4. **Send Parameters**: MsgPack-encoded initial params:
   - `prompt`: Text description
   - `width` / `height`: Video dimensions (normalized to multiples of 8)
   - `num_blocks`: Video length (10-50)
   - `num_denoising_steps`: Quality (fixed at 4)
   - `seed`: Random seed (optional)
5. **Receive Frames**: Binary frames arrive as ArrayBuffer
6. **Display**: Frames decoded with `createImageBitmap` and drawn to canvas
7. **Dynamic Updates**: Send new prompts during generation via MsgPack

### MsgPack Encoding

The app uses a built-in MsgPack encoder (`src/lib/msgpack.ts`) to serialize messages for WebSocket communication. This is more efficient than JSON for binary data and maintains compatibility with fal.ai's realtime API.

### Video Recording

- Automatically starts recording when generation begins
- Uses `MediaRecorder API` to capture canvas stream
- Supports WebM format with VP9/VP8 codecs
- Adjustable playback FPS (1-30)

## API Route

The `/api/fal` endpoint handles two types of requests:

1. **Token Generation** (new): Generates JWT tokens for WebSocket authentication

   ```typescript
   POST /api/fal
   Body: { allowed_apps: ["krea-wan-14b"], token_expiration: 5000 }
   Response: { token: "eyJ..." }
   ```

2. **Proxy Requests** (existing): Forwards requests to fal.ai (from `@fal-ai/server-proxy`)

This keeps your API key secure on the server side.

## UI Components

### Terminal Aesthetic

- **Color Scheme**: Black background with cyan/blue accents
- **Typography**: JetBrains Mono font throughout
- **Borders**: Animated rainbow borders on active elements
- **Cards**: Terminal-style cards with `[ BRACKETS ]` labels

### Layout

```
┌────────────────────────────────────────────────┐
│              HEADER (Logo + Title)              │
├────────────────────┬───────────────────────────┤
│                    │                           │
│   VIDEO OUTPUT     │  GENERATION CONTROLS      │
│   (Canvas Display) │  - Prompt textarea        │
│                    │  - Width/Height inputs    │
│   Status Bar       │  - Blocks slider          │
│   Playback FPS     │  - Seed input             │
│                    │  - Action buttons         │
│                    │                           │
└────────────────────┴───────────────────────────┘
│                   FOOTER                        │
└────────────────────────────────────────────────┘
```

## Parameters

### Video Dimensions

- **Width**: 64-2048px (normalized to multiples of 8)
- **Height**: 64-2048px (normalized to multiples of 8)
- **Default**: 832x480

### Video Length

- **Blocks**: 10-50 (more blocks = longer video)
- **Default**: 20 blocks

### Playback

- **FPS**: 1-30 frames per second
- **Default**: 8 FPS

### Seed

- **Optional**: Leave blank for random
- **Range**: 0 to 2^24 (16,777,216)
- **Use Case**: Same seed + prompt = reproducible results

## Controls

- **[ START ]**: Begin video generation
- **[ STOP ]**: Stop generation and close connection
- **[ RST ]**: Reset session (clear canvas and restart)
- **[ DL ]**: Download recorded video as WebM
- **[ RND ]**: Generate random seed

## Performance

- **Frame Timeout**: 10 seconds (stops if no frames received)
- **Token Expiration**: 5000 seconds (~83 minutes)
- **Frame Buffer**: Smooth playback via queued ImageBitmap objects
- **Connection Status**: Real-time status updates

## Tech Stack

**Frontend:**

- Next.js 15 (React 19)
- TypeScript
- Tailwind CSS v4
- Canvas API
- WebSocket API
- MediaRecorder API

**Backend:**

- Next.js API Routes
- fal.ai REST API (token generation)
- fal.ai WebSocket (video streaming)

**Models:**

- Krea WAN-14B (via fal.ai)

## Troubleshooting

### No Connection

- Verify `FAL_API_KEY` is set in `.env.local`
- Check browser console for error messages
- Ensure you have a valid fal.ai account

### No Frames Received

- Check prompt is not empty
- Verify parameters are within valid ranges
- Look for "Frame timeout" in status bar
- Check network tab for WebSocket errors

### Video Won't Download

- Ensure generation has run (frame count > 0)
- Recording happens automatically during generation
- Try stopping and starting generation again

### Token Errors

- Token expires after 5000 seconds - reconnect if needed
- Check API key has correct permissions
- Verify `/api/fal` endpoint is working (check Network tab)

## Environment Variables

| Variable                    | Required | Default        | Description         |
| --------------------------- | -------- | -------------- | ------------------- |
| `FAL_API_KEY`               | Yes      | -              | Your fal.ai API key |
| `NEXT_PUBLIC_FAL_APP_ALIAS` | No       | `krea-wan-14b` | fal.ai app alias    |
| `NEXT_PUBLIC_APP_URL`       | No       | -              | App URL for SEO     |

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format:write
```

## Deployment

Deploy to Vercel or any Node.js hosting:

```bash
# Set environment variables
FAL_API_KEY=your_key_here

# Deploy
vercel --prod
```

Make sure to set `FAL_API_KEY` in your hosting platform's environment variables.

## Credits

Powered by [fal.ai](https://fal.ai) - Fast, reliable AI infrastructure

Built with Krea's WAN-14B model for real-time video generation.

## License

MIT
