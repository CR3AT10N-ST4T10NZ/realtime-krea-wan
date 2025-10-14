"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { msgpackEncode } from "@/lib/msgpack";
import { Download, Dices, Play, Pause, Loader2 } from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Real-time Video Generation",
  description:
    "AI-powered text-to-video generation with dynamic prompt rewriting using Krea's realtime diffusion technology.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://krea-realtime.fal.ai",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "fal.ai",
    url: "https://fal.ai",
  },
  featureList: [
    "Real-time Video Generation",
    "Dynamic Prompt Rewriting",
    "Text-to-Video AI",
    "WebSocket Streaming",
    "AI-Powered Diffusion",
  ],
};

const FRAME_TIMEOUT_MS = 10000;
const TOKEN_EXPIRATION_SECONDS = 5000;
const FAL_APP_ALIAS = process.env.NEXT_PUBLIC_FAL_APP_ALIAS || "krea-wan-14b";

export default function Page() {
  // State
  const [prompt, setPrompt] = useState(
    "A cat riding a skateboard through a neon city"
  );
  const [width, setWidth] = useState(832);
  const [height, setHeight] = useState(480);
  const [numBlocks, setNumBlocks] = useState(20);
  const [seed, setSeed] = useState("");
  const [playbackFps, setPlaybackFps] = useState(8);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [status, setStatus] = useState("Disconnected");
  const [hasRecordedVideo, setHasRecordedVideo] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameBufferRef = useRef<ImageBitmap[]>([]);
  const storedFramesRef = useRef<Blob[]>([]); // Store frames for video export
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const frameTimeoutCheckRef = useRef<NodeJS.Timeout | null>(null);
  const playbackLoopRef = useRef<NodeJS.Timeout | null>(null);
  const playbackFrameIndexRef = useRef<number>(0);

  // Initialize FFmpeg
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    try {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      ffmpegRef.current = ffmpeg;
      console.log("FFmpeg loaded successfully");
      return ffmpeg;
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      return null;
    }
  }, []);

  // Fetch temporary token for WebSocket authentication
  const fetchTemporaryToken = async (appAlias: string): Promise<string> => {
    try {
      console.log("Fetching temporary token for app:", appAlias);
      const response = await fetch("/api/fal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          allowed_apps: [appAlias],
          token_expiration: TOKEN_EXPIRATION_SECONDS,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("Token fetch failed:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Failed to fetch token: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`
        );
      }

      const data = await response.json();

      // Check for error in response
      if (data?.error) {
        throw new Error(`API Error: ${data.error}`);
      }

      const token =
        data?.token ||
        data?.jwt ||
        data?.access_token ||
        (typeof data === "string" ? data : null);

      if (!token || typeof token !== "string") {
        throw new Error(
          `Token missing in response: ${JSON.stringify(data).slice(0, 200)}`
        );
      }

      console.log("JWT Token fetched successfully");
      return token;
    } catch (error) {
      console.error("Token fetch error:", error);
      throw error;
    }
  };

  // Frame timeout watchdog
  useEffect(() => {
    if (!isGenerating) {
      if (frameTimeoutCheckRef.current) {
        clearInterval(frameTimeoutCheckRef.current);
        frameTimeoutCheckRef.current = null;
      }
      return;
    }

    frameTimeoutCheckRef.current = setInterval(() => {
      if (lastFrameTimeRef.current) {
        const timeSinceLastFrame = Date.now() - lastFrameTimeRef.current;
        if (timeSinceLastFrame > FRAME_TIMEOUT_MS) {
          setStatus("Stopped - no frames received");
          setIsGenerating(false);
        }
      }
    }, 2000);

    return () => {
      if (frameTimeoutCheckRef.current) {
        clearInterval(frameTimeoutCheckRef.current);
        frameTimeoutCheckRef.current = null;
      }
    };
  }, [isGenerating]);

  // Generate random seed
  const randomizeSeed = useCallback(() => {
    setSeed(String(Math.floor(Math.random() * (1 << 24))));
  }, []);

  // Start frame capture for video export
  const startRecording = useCallback(() => {
    storedFramesRef.current = [];
    setHasRecordedVideo(false);
    console.log("Started capturing frames for video export");
  }, []);

  // Stop frame capture and enable download
  const stopRecording = useCallback(() => {
    if (storedFramesRef.current.length > 0) {
      setHasRecordedVideo(true);
      console.log(
        "Frame capture complete:",
        storedFramesRef.current.length,
        "frames"
      );
    }
  }, []);

  // Play stored frames on canvas
  const playStoredFrames = useCallback(() => {
    if (storedFramesRef.current.length === 0 || !canvasRef.current) return;

    setIsPlaying(true);
    playbackFrameIndexRef.current = 0;

    const renderFrame = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const frameIndex = playbackFrameIndexRef.current;
      if (frameIndex >= storedFramesRef.current.length) {
        // Loop playback
        playbackFrameIndexRef.current = 0;
        return;
      }

      try {
        const blob = storedFramesRef.current[frameIndex];
        const bitmap = await createImageBitmap(blob);

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
        }

        if (typeof bitmap.close === "function") {
          bitmap.close();
        }

        playbackFrameIndexRef.current++;
      } catch (error) {
        console.error("Failed to render playback frame:", error);
      }
    };

    // Start playback loop
    const frameInterval = 1000 / playbackFps;
    playbackLoopRef.current = setInterval(renderFrame, frameInterval);
    renderFrame(); // Render first frame immediately
  }, [playbackFps]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackLoopRef.current) {
      clearInterval(playbackLoopRef.current);
      playbackLoopRef.current = null;
    }
    playbackFrameIndexRef.current = 0;
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playStoredFrames();
    }
  }, [isPlaying, stopPlayback, playStoredFrames]);

  // Download video using FFmpeg
  const downloadVideo = useCallback(async () => {
    if (storedFramesRef.current.length === 0) {
      console.log("No frames to export");
      return;
    }

    setIsProcessingVideo(true);
    setStatus("Processing video with FFmpeg...");

    try {
      // Load FFmpeg if not already loaded
      const ffmpeg = await loadFFmpeg();
      if (!ffmpeg) {
        throw new Error("Failed to load FFmpeg");
      }

      console.log(
        `Encoding ${storedFramesRef.current.length} frames at ${playbackFps}fps`
      );

      // Write frames to FFmpeg's virtual filesystem
      for (let i = 0; i < storedFramesRef.current.length; i++) {
        const frameData = await fetchFile(storedFramesRef.current[i]);
        ffmpeg.writeFile(
          `frame${i.toString().padStart(5, "0")}.jpg`,
          frameData
        );
      }

      // Run FFmpeg to create video
      await ffmpeg.exec([
        "-framerate",
        playbackFps.toString(),
        "-i",
        "frame%05d.jpg",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "output.mp4",
      ]);

      // Read the output video
      const data = await ffmpeg.readFile("output.mp4");

      // Clean up FFmpeg filesystem
      for (let i = 0; i < storedFramesRef.current.length; i++) {
        try {
          await ffmpeg.deleteFile(`frame${i.toString().padStart(5, "0")}.jpg`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      try {
        await ffmpeg.deleteFile("output.mp4");
      } catch (e) {
        // Ignore cleanup errors
      }

      // Download the video
      // Convert FileData to buffer for blob creation
      const videoData = new Uint8Array(data as Uint8Array);
      const blob = new Blob([videoData.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      a.download = `generated-video-${timestamp}.mp4`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      console.log("Video downloaded successfully");
      setStatus(isGenerating ? "Generating..." : "Ready");
    } catch (error) {
      console.error("Failed to create video:", error);
      setStatus(`Error creating video: ${error}`);
    } finally {
      setIsProcessingVideo(false);
    }
  }, [playbackFps, loadFFmpeg, isGenerating]);

  // Display frame on canvas
  const displayFrame = useCallback(async (imageData: ArrayBuffer | Blob) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastFrameTimeRef.current = Date.now();
    setFrameCount((prev) => prev + 1);

    try {
      const blob =
        imageData instanceof Blob
          ? imageData
          : new Blob([imageData], { type: "image/jpeg" });

      const bitmap = await createImageBitmap(blob);
      frameBufferRef.current.push(bitmap);

      // Also store the blob for video export
      storedFramesRef.current.push(blob);
    } catch (error) {
      console.error("Failed to decode frame:", error);
    }
  }, []);

  // Draw next frame from buffer
  const drawNextFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || frameBufferRef.current.length === 0) return;

    const bitmap = frameBufferRef.current.shift();
    if (!bitmap) return;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0);
    }

    if (typeof bitmap.close === "function") {
      bitmap.close();
    }
  }, []);

  // Start playback loop
  const startPlaybackLoop = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    const intervalMs = Math.max(
      10,
      Math.floor(1000 / Math.max(1, playbackFps))
    );
    playbackIntervalRef.current = setInterval(drawNextFrame, intervalMs);
  }, [playbackFps, drawNextFrame]);

  // Stop playback loop
  const stopPlaybackLoop = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }, []);

  // Send prompt update (dynamic rewriting)
  const sendPromptUpdate = useCallback(
    (newPrompt: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && isConnected) {
        const update = {
          prompt: newPrompt,
          num_blocks: numBlocks,
        };
        wsRef.current.send(msgpackEncode(update));
        console.log("Sent prompt update:", newPrompt);
      }
    },
    [isConnected, numBlocks]
  );

  // Handle prompt change with debouncing
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);

    // Send prompt updates during generation
    if (isGenerating) {
      if (textDebounceRef.current) {
        clearTimeout(textDebounceRef.current);
      }
      textDebounceRef.current = setTimeout(() => {
        sendPromptUpdate(newPrompt);
      }, 500);
    }
  };

  // Send initial parameters
  const sendParams = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatus("WebSocket not connected");
      setIsGenerating(false);
      return false;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setStatus("Please enter a prompt before starting");
      setIsGenerating(false);
      if (wsRef.current) {
        wsRef.current.close(1000, "missing prompt");
      }
      return false;
    }

    const normalizedWidth = Math.max(64, Math.round(width / 8) * 8);
    const normalizedHeight = Math.max(64, Math.round(height / 8) * 8);

    if (normalizedWidth !== width) setWidth(normalizedWidth);
    if (normalizedHeight !== height) setHeight(normalizedHeight);

    const payload: Record<string, any> = {
      prompt: trimmedPrompt,
      width: normalizedWidth,
      height: normalizedHeight,
      num_blocks: numBlocks,
      num_denoising_steps: 4,
    };

    // Add seed if provided
    const trimmedSeed = seed.trim();
    if (trimmedSeed === "") {
      payload.seed = Math.floor(Math.random() * (1 << 24));
    } else {
      const numericSeed = Number(trimmedSeed);
      if (!isNaN(numericSeed) && isFinite(numericSeed)) {
        payload.seed = Math.floor(numericSeed);
      }
    }

    // Clear canvas and buffers
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    frameBufferRef.current = [];

    // Start recording and playback
    startRecording();
    startPlaybackLoop();
    lastFrameTimeRef.current = Date.now();

    try {
      const encoded = msgpackEncode(payload);
      wsRef.current.send(encoded);
      setStatus("Generation started");
      console.log("Sent initial params:", payload);
      return true;
    } catch (error) {
      console.error("Failed to send parameters:", error);
      setStatus(`Failed to send parameters: ${error}`);
      setIsGenerating(false);
      if (wsRef.current) {
        wsRef.current.close(1000, "send failed");
      }
      return false;
    }
  }, [
    prompt,
    width,
    height,
    numBlocks,
    seed,
    startRecording,
    startPlaybackLoop,
  ]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setStatus("Already connected");
      return;
    }

    setStatus("Fetching authentication token...");
    let token;
    try {
      token = await fetchTemporaryToken(FAL_APP_ALIAS);
    } catch (error: any) {
      console.error("Failed to fetch JWT token:", error);
      setStatus(`Auth failed: ${error.message}`);
      return;
    }

    setStatus("Connecting to WebSocket...");
    const encodedToken = encodeURIComponent(token);
    const wsUrl = `wss://fal.run/fal-ai/${FAL_APP_ALIAS}/ws?fal_jwt_token=${encodedToken}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("WebSocket connection opened successfully");
      setStatus("Connected, waiting for ready signal...");
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "ready") {
            setStatus("Ready - sending initial params...");
            const success = await sendParams();
            if (success) {
              setIsConnected(true);
            }
          } else if (data.error) {
            setStatus(`Server error: ${JSON.stringify(data.error)}`);
            console.error("Server validation error:", data.error);
            setIsGenerating(false);
            if (wsRef.current) {
              wsRef.current.close(1000, "validation error");
            }
          } else if (data.status) {
            setStatus(data.status);
          }
        } catch {
          console.error("Error parsing message:", event.data);
        }
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        displayFrame(event.data);
      } else if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        displayFrame(arrayBuffer);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Connection error");
    };

    ws.onclose = (event) => {
      const closeReasons: Record<number, string> = {
        1000: "Normal Closure",
        1001: "Going Away",
        1002: "Protocol Error",
        1003: "Unsupported Data",
        1005: "No Status Received",
        1006: "Abnormal Closure",
        1007: "Invalid Frame Payload Data",
        1008: "Policy Violation",
        1009: "Message Too Big",
        1010: "Mandatory Extension",
        1011: "Internal Server Error",
        1015: "TLS Handshake Failed",
      };

      console.log("WebSocket closed:", {
        code: event.code,
        reason: event.reason || closeReasons[event.code] || "Unknown reason",
        wasClean: event.wasClean,
      });

      setStatus(
        `Disconnected: ${event.reason || closeReasons[event.code] || "Unknown"} (${event.code})`
      );
      setIsConnected(false);
      setIsGenerating(false);
      stopPlaybackLoop();
      setTimeout(() => stopRecording(), 500);
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [sendParams, displayFrame, stopPlaybackLoop, stopRecording]);

  // Toggle generation
  const toggleGeneration = async () => {
    if (isGenerating) {
      setIsGenerating(false);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "stopped by user");
      }
      stopPlaybackLoop();
      setTimeout(() => stopRecording(), 500);
    } else {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setStatus("Error: Please enter a prompt before starting");
        return;
      }

      // Stop playback if playing
      if (isPlaying) {
        stopPlayback();
      }

      setIsGenerating(true);
      setFrameCount(0);
      connect();
    }
  };

  // Reset session
  const resetSession = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const resetMsg = msgpackEncode({ action: "reset" });
      wsRef.current.send(resetMsg);
      setFrameCount(0);
      setStatus("Session reset");

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      frameBufferRef.current = [];

      // Clear stored frames and restart capture
      storedFramesRef.current = [];
      setHasRecordedVideo(false);
      startRecording();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        toggleGeneration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, prompt]); // Include dependencies that toggleGeneration uses

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (textDebounceRef.current) {
        clearTimeout(textDebounceRef.current);
      }
      stopPlaybackLoop();
      stopRecording();
      stopPlayback();
    };
  }, [stopPlaybackLoop, stopRecording, stopPlayback]);

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <div className="bg-terminal-background min-h-screen text-text-primary font-mono relative overflow-hidden flex flex-col">
        {/* Header */}
        <header className="w-full py-6 px-4 relative z-10 border-b border-border-default">
          <div className="container mx-auto flex items-center justify-between">
            <Link href="https://fal.ai" target="_blank">
              <Logo className="h-8 w-16 text-text-primary" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              [ REAL-TIME VIDEO GENERATION ]
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center md:-mt-16">
          <div className="container mx-auto px-4 max-w-7xl relative z-10 w-full">
            {/* Title */}
            <h2 className=" text-2xl sm:text-3xl font-bold text-text-primary text-center mb-8 font-mono">
              KREA WAN 14B REALTIME
            </h2>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Controls - Takes 1 column on the left */}
              <div className="flex flex-col h-full">
                <Card className="h-full">
                  <CardHeader className="space-y-1 text-center pb-2 border-b border-border-default">
                    <div className="text-text-primary font-mono text-lg font-bold">
                      [1] GENERATION CONTROLS
                    </div>
                    <CardDescription className="font-mono text-xs">
                      PARAMETER CONFIGURATION
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Prompt */}
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                        PROMPT
                        {isGenerating && (
                          <span className="ml-2 text-green-400">
                            (LIVE UPDATES)
                          </span>
                        )}
                      </label>
                      <textarea
                        value={prompt}
                        onChange={handlePromptChange}
                        className="w-full px-3 py-2.5 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition resize-none text-sm font-mono text-text-primary"
                        rows={3}
                        placeholder="Describe what you want to generate..."
                      />
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        Changes update in real-time while generating
                      </p>
                    </div>

                    {/* Width and Height */}
                    {/* <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                          WIDTH
                        </label>
                        <input
                          type="number"
                          min="64"
                          step="8"
                          value={width}
                          onChange={(e) => setWidth(parseInt(e.target.value))}
                          disabled={isGenerating || true}
                          className="w-full px-3 py-2 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none text-sm font-mono text-text-primary disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                          HEIGHT
                        </label>
                        <input
                          type="number"
                          min="64"
                          step="8"
                          value={height}
                          onChange={(e) => setHeight(parseInt(e.target.value))}
                          disabled={isGenerating || true}
                          className="w-full px-3 py-2 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none text-sm font-mono text-text-primary disabled:opacity-50"
                        />
                      </div>
                    </div> */}

                    {/* Blocks Slider */}
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                        VIDEO LENGTH (BLOCKS): {numBlocks}
                      </label>
                      <Slider
                        min={10}
                        max={50}
                        step={5}
                        value={[numBlocks]}
                        onValueChange={(value) => setNumBlocks(value[0])}
                        disabled={isGenerating}
                        className="w-full"
                      />
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        More blocks = longer video
                      </p>
                    </div>

                    {/* Seed */}
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                        SEED (OPTIONAL)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={seed}
                          onChange={(e) => setSeed(e.target.value)}
                          placeholder="random"
                          disabled={isGenerating}
                          className="flex-1 px-3 py-2 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none text-sm font-mono text-text-primary disabled:opacity-50"
                        />
                        <Button
                          onClick={randomizeSeed}
                          disabled={isGenerating}
                          variant="default"
                          className="px-4 py-2 text-sm font-mono"
                        >
                          <Dices className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                        PLAYBACK FPS: {playbackFps}
                      </label>
                      <Slider
                        min={1}
                        max={30}
                        step={1}
                        value={[playbackFps]}
                        onValueChange={(value) => {
                          const fps = value[0];
                          setPlaybackFps(fps);
                          if (playbackIntervalRef.current) {
                            startPlaybackLoop();
                          }
                        }}
                        className="w-full"
                      />
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        Frame rate for video playback
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {/* Play Button - appears when frames are ready */}
                      {hasRecordedVideo && (
                        <Button
                          onClick={togglePlayback}
                          className="px-4 py-3 font-mono"
                          variant="green"
                          title={isPlaying ? "Pause playback" : "Play video"}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        onClick={toggleGeneration}
                        className="flex-1 py-3 text-sm font-bold font-mono flex items-center justify-between"
                        variant={isGenerating ? "red" : "blue"}
                      >
                        <span>{isGenerating ? "[ STOP ]" : "[ START ]"}</span>
                        <span className="flex items-center gap-1 text-xs opacity-70">
                          <kbd
                            className={cn(
                              "px-1.5 py-0.5 bg-black/20 border rounded-none text-[10px]",
                              isGenerating
                                ? "border-red-500/40"
                                : "border-blue-500/40"
                            )}
                          >
                            ⌘
                          </kbd>
                          <kbd
                            className={cn(
                              "px-1.5 py-0.5 bg-black/20 border rounded-none text-[10px]",
                              isGenerating
                                ? "border-red-500/40"
                                : "border-blue-500/40"
                            )}
                          >
                            ↵
                          </kbd>
                        </span>
                      </Button>
                      {/* 
                      {isConnected && (
                        <Button
                          onClick={resetSession}
                          variant="default"
                          className="px-4 py-3 font-mono"
                          title="Reset session"
                        >
                          [ RESET ]
                        </Button>
                      )} */}

                      <Button
                        onClick={downloadVideo}
                        disabled={!hasRecordedVideo || isProcessingVideo}
                        variant="default"
                        className="px-4 py-3 font-mono"
                        title={
                          isProcessingVideo
                            ? "Processing video..."
                            : "Download video"
                        }
                      >
                        {isProcessingVideo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Video Output - Takes 2 columns on the right */}
              <div className="lg:col-span-2 flex flex-col h-full">
                <Card className="h-full transition-all duration-300">
                  <CardHeader className="space-y-1 text-center pb-2 border-b border-border-default">
                    <div className="text-text-primary font-mono text-lg font-bold">
                      [2] VIDEO OUTPUT
                    </div>
                    <CardDescription className="font-mono text-xs">
                      GENERATED FRAMES DISPLAY
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="relative w-full bg-terminal-background border border-border-default flex items-center justify-center overflow-hidden aspect-video">
                      <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain"
                      />
                      {frameCount === 0 && (
                        <div className="absolute text-center p-8 border-rainbow">
                          <p className="text-text-primary font-mono text-sm">
                            [ AWAITING VIDEO GENERATION ]
                          </p>
                        </div>
                      )}
                      {isGenerating && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 border border-red-500/30 px-3 py-1">
                          <div className="h-2 w-2 bg-red-500 animate-pulse" />
                          <span className="text-xs font-mono text-red-400">
                            GENERATING
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status Bar */}
                    <div className="mt-4 flex items-center justify-between gap-4 text-sm border-t border-border-default pt-4">
                      <div className="flex items-center gap-6">
                        <div
                          className={cn(
                            "px-3 py-1 rounded-none text-xs font-medium font-mono",
                            isConnected
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          )}
                        >
                          {status}
                        </div>
                        <span className="text-text-muted font-mono text-xs">
                          FRAMES:{" "}
                          <span className="font-semibold text-text-primary">
                            {frameCount}
                          </span>
                        </span>
                        <span className="text-text-muted font-mono text-xs">
                          BLOCKS:{" "}
                          <span className="font-semibold text-text-primary">
                            {numBlocks}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full relative z-10">
          <div className="py-4 border-t border-border-default">
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center space-x-2 text-text-muted font-mono text-xs">
                <span>POWERED BY</span>
                <Link
                  href="https://fal.ai"
                  target="_blank"
                  className="hover:text-text-emphasis transition-colors"
                >
                  <Logo className="h-6 w-12 text-text-primary" />
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="https://fal.ai/docs"
                  target="_blank"
                  className={buttonVariants({
                    variant: "ghost",
                  })}
                >
                  [ BUILD YOUR OWN ]
                </Link>

                <Link
                  href="https://github.com/fal-ai"
                  target="_blank"
                  className={buttonVariants({
                    variant: "ghost",
                  })}
                >
                  [ VIEW SOURCE ]
                </Link>
              </div>

              <p className="text-xs text-text-muted max-w-2xl mx-auto font-mono">
                &gt; REAL-TIME VIDEO GENERATION SYSTEM v1.0
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
