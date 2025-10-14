# Setup Guide - Krea Realtime Video Generation

This guide will help you get the Krea realtime video generation app up and running.

## 🚀 Quick Start

### 1. Create Environment Variables

Create a `.env.local` file in the root directory with your fal.ai API key:

```bash
# Required: Your fal.ai API key
FAL_API_KEY=your_actual_api_key_here

# Optional: Override the default app alias
NEXT_PUBLIC_FAL_APP_ALIAS=krea-wan-14b

# Optional: Set your app URL for SEO
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**How to get your API key:**

1. Go to [https://fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)
2. Create a new API key
3. Copy it to your `.env.local` file

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📝 What Changed

### Files Modified

1. **`src/app/page.tsx`** - Complete rewrite
   - Removed: Webcam streaming, facial recognition, brainrot UI
   - Added: Text-to-video generation, WebSocket management, canvas display, video recording

2. **`src/app/api/fal/route.ts`** - Enhanced API route
   - Added JWT token generation for WebSocket authentication
   - Maintains existing proxy functionality

3. **`src/lib/msgpack.ts`** - New file
   - Custom MsgPack encoder for WebSocket communication
   - Handles binary data encoding for fal.ai's realtime API

4. **`src/app/layout.tsx`** - Updated metadata
   - Changed title, description, keywords for video generation
   - Updated OpenGraph and Twitter card metadata

5. **`README.md`** - Complete rewrite
   - Documentation for video generation app
   - Setup instructions, API details, troubleshooting

## 🎮 How to Use

### Basic Usage

1. **Enter a Prompt**: Describe the video you want to generate
   - Example: "A cat riding a skateboard through a neon city"

2. **Adjust Parameters** (optional):
   - **Width/Height**: Video dimensions (default 832x480)
   - **Blocks**: Video length, 10-50 (default 20)
   - **Seed**: For reproducible results (leave blank for random)

3. **Click [ START ]**: Begin video generation

4. **Watch It Generate**: Frames appear in real-time on the canvas

5. **Update Prompt** (optional): Change the prompt while generating to see dynamic updates

6. **Download**: Click [ DL ] to save the video

### Advanced Features

#### Dynamic Prompt Rewriting

While the video is generating, you can update the prompt and see the changes in real-time. The app debounces your input (500ms) and sends updates via MsgPack.

#### Playback Speed Control

Use the playback FPS slider (1-30) to adjust how fast frames are displayed. This doesn't affect generation speed, only local playback.

#### Reset Session

Click [ RST ] to clear the canvas and restart generation with the same connection.

#### Random Seed

Click [ RND ] to generate a random seed value.

## 🔧 Technical Details

### Architecture

```
Frontend (Next.js)
    ↓
/api/fal endpoint
    ↓
Generate JWT Token
    ↓
WebSocket Connection (wss://fal.run/fal-ai/krea-wan-14b/ws)
    ↓
Send MsgPack Encoded Params
    ↓
Receive Binary Frames
    ↓
Display on Canvas + Record
```

### WebSocket Protocol

1. **Authentication**: JWT token passed as query parameter
2. **Ready Signal**: Server sends `{status: "ready"}` when ready
3. **Parameter Format**: MsgPack encoded object:
   ```javascript
   {
     prompt: string,
     width: number,  // multiple of 8
     height: number, // multiple of 8
     num_blocks: number,
     num_denoising_steps: 4,
     seed: number (optional)
   }
   ```
4. **Frame Format**: Binary (ArrayBuffer) containing JPEG data
5. **Dynamic Updates**: Send new prompts via MsgPack during generation

### Video Recording

- **Format**: WebM (VP9 or VP8 codec)
- **Capture**: Canvas stream via `captureStream()`
- **Recording**: MediaRecorder API
- **Download**: Blob URL created on-demand

### Frame Handling

- **Buffer**: ImageBitmap queue for smooth playback
- **Display**: Canvas 2D context
- **Playback Loop**: SetInterval based on FPS setting
- **Timeout**: 10 second watchdog stops generation if no frames received

## 🐛 Troubleshooting

### "FAL_API_KEY not configured"

- Ensure `.env.local` exists in root directory
- Verify `FAL_API_KEY=your_key` is set correctly
- Restart dev server after creating `.env.local`

### "Failed to fetch token"

- Check API key is valid (test at fal.ai dashboard)
- Verify you're logged into fal.ai
- Check network connectivity

### "WebSocket closed: Policy Violation (1008)"

- Token may be invalid or expired
- Check API key has correct permissions
- Try generating a new token (restart the app)

### No Frames Received

- Verify prompt is not empty
- Check parameters are within valid ranges:
  - Width/Height: 64-2048, multiples of 8
  - Blocks: 10-50
- Look for error messages in browser console
- Check network tab for WebSocket errors

### Can't Download Video

- Ensure generation has run (frame count > 0)
- Recording starts automatically when you click [ START ]
- Try stopping and restarting generation

### Slow Performance

- Reduce playback FPS (doesn't affect generation)
- Close other browser tabs
- Check your internet connection speed

## 📊 Performance Metrics

### Expected Behavior

- **Frame Rate**: Varies based on server load and complexity
- **Latency**: Depends on network and server processing
- **Token Lifetime**: 5000 seconds (~83 minutes)
- **Frame Timeout**: 10 seconds without frames triggers stop

### Monitoring

- Status bar shows connection state
- Frame counter tracks received frames
- Blocks counter shows video length parameter

## 🔒 Security

### API Key Protection

- API key stored server-side in `.env.local`
- Never exposed to browser
- All authentication handled via JWT tokens
- Tokens expire automatically

### Bot Protection

- BotId client enabled on API routes
- Rate limiting can be added to `/api/fal` endpoint

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# FAL_API_KEY=your_key_here
```

### Other Platforms

Works on any Node.js hosting that supports:

- Next.js 15
- Environment variables
- WebSocket connections

## 📚 Additional Resources

- [fal.ai Documentation](https://fal.ai/docs)
- [fal.ai Dashboard](https://fal.ai/dashboard)
- [Krea AI](https://krea.ai)
- [Next.js Documentation](https://nextjs.org/docs)

## 💡 Tips

1. **Good Prompts**: Be descriptive and specific
   - ✅ "A majestic dragon flying over a cyberpunk city at sunset"
   - ❌ "dragon"

2. **Dimensions**: Use standard aspect ratios
   - 16:9 → 832x480 (default)
   - 4:3 → 640x480
   - 1:1 → 512x512

3. **Blocks**: Start with 20, adjust based on desired length
   - 10-15: Short clips
   - 20-30: Medium length
   - 35-50: Longer videos

4. **Seeds**: Use the same seed for reproducible results
   - Great for iterating on prompts
   - Share seeds with others for same results

## ❓ FAQ

**Q: Is this free?**
A: You need a fal.ai account with credits. Check [fal.ai pricing](https://fal.ai/pricing).

**Q: How long does generation take?**
A: Depends on parameters and server load. Frames arrive in real-time as they're generated.

**Q: Can I use this commercially?**
A: Check fal.ai and Krea's terms of service for usage rights.

**Q: What video formats are supported?**
A: Output is WebM. You can convert to MP4 using tools like FFmpeg.

**Q: Can I run this offline?**
A: No, requires internet connection to fal.ai servers.

## 🤝 Support

- Issues: File on GitHub repository
- fal.ai Support: [support@fal.ai](mailto:support@fal.ai)
- Discord: Join fal.ai community

---

**Built with ❤️ using fal.ai and Krea AI**
