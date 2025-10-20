"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { buttonVariants } from "@/components/ui/button";
import KonvaEditor, {
  KonvaEditorHandle,
} from "@/components/canvas/KonvaEditor";
import { Logo, LogoIcon } from "@/components/icons/logo";
import Link from "next/link";
import { Github } from "lucide-react";
import { ControlsPanel } from "@/components/ControlsPanel";
import { VideoOutput } from "@/components/VideoOutput";
import { useWebcam } from "@/hooks/useWebcam";
import { useFFmpeg } from "@/hooks/useFFmpeg";
import { useFrameCapture } from "@/hooks/useFrameCapture";
import { useWebSocket } from "@/hooks/useWebSocket";

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

const FAL_APP_ALIAS = process.env.NEXT_PUBLIC_FAL_APP_ALIAS || "krea-wan-14b";

const PROMPT_PRESETS = [
  "Professional grade video of a man wearing sunglasses and relaxing at the beach. He has a calm expression on his face.",
  "Professional grade video of a woman sipping coffee at a cozy cafe. She has a content and peaceful expression.",
  "Professional grade video of a chef preparing a gourmet dish in a modern kitchen. He has a focused and concentrated expression.",
  "Professional grade video of a musician playing piano in a concert hall. She has a passionate and emotional expression.",
  "Professional grade video of a painter creating artwork in a bright studio. He has an inspired and creative expression.",
  "Professional grade video of a woman reading a book in a library. She has a thoughtful and engaged expression.",
  "Professional grade video of a man jogging through a park at sunrise. He has an energized and determined expression.",
  "Professional grade video of a baker kneading dough in a rustic bakery. She has a satisfied and joyful expression.",
  "Professional grade video of a woman meditating on a mountain overlook. She has a serene and tranquil expression.",
  "Professional grade video of a man writing in a journal at a wooden desk. He has a contemplative and reflective expression.",
  "Professional grade video of a florist arranging flowers in a boutique shop. She has a delicate and careful expression.",
  "Professional grade video of a photographer capturing landscapes at golden hour. He has an adventurous and excited expression.",
  "Professional grade video of a woman dancing in a sunlit dance studio. She has a graceful and flowing expression.",
  "Professional grade video of a man grilling food at a backyard barbecue. He has a cheerful and welcoming expression.",
  "Professional grade video of a teacher explaining concepts in a bright classroom. She has an enthusiastic and encouraging expression.",
];

export default function Page() {
  // UI State
  const [mode, setMode] = useState<"text" | "canvas" | "webcam">("text");
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0]);
  const [width, setWidth] = useState(832);
  const [height, setHeight] = useState(480);
  const [hasActiveWebcam, setHasActiveWebcam] = useState(false);
  const [numBlocks] = useState(1000);
  const [seed, setSeed] = useState("");
  const [playbackFps, setPlaybackFps] = useState(8);
  const [inputFps, setInputFps] = useState(10);
  const [strength, setStrength] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs
  const konvaRef = useRef<KonvaEditorHandle | null>(null);

  // Custom Hooks
  const { webcamStream, webcamVideoRef, startWebcam, stopWebcam } = useWebcam();
  const { exportVideo, isProcessingVideo } = useFFmpeg();
  const {
    canvasRef,
    hasRecordedVideo,
    isPlaying,
    frameCount,
    storedFrames,
    lastFrameTime,
    extractFrameBytes,
    displayFrame,
    startPlaybackLoop,
    stopPlaybackLoop,
    startRecording,
    stopRecording,
    togglePlayback,
    clearCanvas,
    setFrameCount,
  } = useFrameCapture(playbackFps);

  const {
    isConnected,
    status,
    connect,
    disconnect,
    sendPromptUpdate,
    createSendParams,
    startFrameExtraction,
    textDebounceRef,
    cleanup: cleanupWebSocket,
    setStatus,
  } = useWebSocket({
    appAlias: FAL_APP_ALIAS,
    onFrameReceived: displayFrame,
  });

  // Utility functions
  const surpriseMe = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * PROMPT_PRESETS.length);
    setPrompt(PROMPT_PRESETS[randomIndex]);
  }, []);

  const randomizeSeed = useCallback(() => {
    setSeed(String(Math.floor(Math.random() * (1 << 24))));
  }, []);

  // Handle webcam capture
  const handleAddWebcam = async () => {
    if (!konvaRef.current) return;
    if (hasActiveWebcam) {
      alert(
        "Only one webcam can be active at a time. Please remove the existing webcam first."
      );
      return;
    }
    await konvaRef.current.addWebcam();
  };

  // Handle image upload
  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !konvaRef.current) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          konvaRef.current?.addImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Handle prompt change with debouncing
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);

    if (
      isGenerating &&
      (mode === "text" || mode === "canvas" || mode === "webcam")
    ) {
      if (textDebounceRef.current) {
        clearTimeout(textDebounceRef.current);
      }
      textDebounceRef.current = setTimeout(() => {
        sendPromptUpdate(newPrompt, numBlocks);
      }, 500);
    }
  };

  // Extract frame wrapper for current mode
  const extractCurrentFrame = useCallback(async () => {
    return extractFrameBytes(mode, konvaRef, webcamVideoRef);
  }, [mode, extractFrameBytes]);

  // Start frame extraction wrapper
  const startFrameExtractionWrapper = useCallback(
    (fps: number = inputFps) => {
      startFrameExtraction(fps, extractCurrentFrame, {
        strength,
        prompt,
        numBlocks,
      });
    },
    [
      startFrameExtraction,
      extractCurrentFrame,
      strength,
      prompt,
      numBlocks,
      inputFps,
    ]
  );

  // Toggle generation
  const toggleGeneration = useCallback(async () => {
    if (isGenerating) {
      setIsGenerating(false);
      disconnect();
      stopPlaybackLoop();
      stopRecording();
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setStatus("Error: Please enter a prompt before starting");
      return;
    }

    // Stop playback if playing
    if (isPlaying) {
      togglePlayback();
    }

    // Extract start frame for canvas/webcam modes
    let startFrame: Uint8Array | null = null;
    if (mode === "canvas" || mode === "webcam") {
      startFrame = await extractCurrentFrame();
      if (!startFrame || !(startFrame instanceof Uint8Array)) {
        setStatus(
          `Failed to extract valid start frame from ${mode === "canvas" ? "canvas" : "webcam"}`
        );
        return;
      }
    }

    setIsGenerating(true);
    setFrameCount(0);

    const sendParams = createSendParams(
      {
        prompt,
        width,
        height,
        numBlocks,
        seed,
        strength,
        mode,
        startFrame,
        inputFps,
        onWidthChange: setWidth,
        onHeightChange: setHeight,
      },
      {
        clearCanvas,
        startRecording,
        startPlaybackLoop,
        updateLastFrameTime: () => {
          lastFrameTime.current = Date.now();
        },
        extractFrameBytes: extractCurrentFrame,
        startFrameExtraction: startFrameExtractionWrapper,
        setIsGenerating,
      }
    );

    await connect(sendParams, {
      stopPlaybackLoop,
      stopRecording,
      setIsGenerating,
    });
  }, [
    isGenerating,
    mode,
    prompt,
    width,
    height,
    numBlocks,
    seed,
    strength,
    isPlaying,
    extractCurrentFrame,
    createSendParams,
    connect,
    disconnect,
    stopPlaybackLoop,
    stopRecording,
    clearCanvas,
    startRecording,
    startPlaybackLoop,
    lastFrameTime,
    startFrameExtractionWrapper,
    togglePlayback,
    setFrameCount,
    setStatus,
  ]);

  // Download video
  const downloadVideo = useCallback(async () => {
    if (storedFrames.current.length === 0) {
      console.log("No frames to export");
      return;
    }

    setStatus("Processing video with FFmpeg...");

    try {
      const blob = await exportVideo(storedFrames.current, playbackFps);

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
    }
  }, [exportVideo, isGenerating, playbackFps, setStatus, storedFrames]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        toggleGeneration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleGeneration]);

  // Handle mode changes - start/stop webcam
  useEffect(() => {
    if (mode === "webcam") {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      if (mode === "webcam") {
        stopWebcam();
      }
    };
  }, [mode, startWebcam, stopWebcam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupWebSocket();
      stopWebcam();
    };
  }, [cleanupWebSocket, stopWebcam]);

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
              <Logo className="h-8 w-16" />
            </Link>
            <Link
              href="https://github.com/fal-ai-community/realtime-krea-wan"
              target="_blank"
              className={buttonVariants({
                variant: "default",
              })}
            >
              <Github className="h-4 w-4" />
              VIEW SOURCE
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center py-8">
          <div className="container mx-auto px-4 max-w-7xl relative z-10 w-full">
            {/* Title */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <LogoIcon
                className="h-8 w-8 sm:h-10 sm:w-10"
                style={{ color: "#CE1241" }}
              />
              <div className="h-8 w-px bg-border-default sm:h-10" />
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
                KREA WAN 14B REALTIME
              </h2>
            </div>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Controls - Takes 1 column on the left */}
              <div className="flex flex-col h-full">
                <ControlsPanel
                  mode={mode}
                  onModeChange={setMode}
                  prompt={prompt}
                  onPromptChange={handlePromptChange}
                  onSurpriseMe={surpriseMe}
                  konvaRef={konvaRef}
                  webcamVideoRef={webcamVideoRef}
                  webcamStream={webcamStream}
                  width={width}
                  height={height}
                  inputFps={inputFps}
                  onInputFpsChange={setInputFps}
                  hasActiveWebcam={hasActiveWebcam}
                  onShapesChange={(shapes) => {
                    const hasWebcam = shapes.some(
                      (shape: any) => shape.type === "webcam"
                    );
                    setHasActiveWebcam(hasWebcam);
                  }}
                  onAddWebcam={handleAddWebcam}
                  onImageUpload={handleImageUpload}
                  strength={strength}
                  onStrengthChange={setStrength}
                  seed={seed}
                  onSeedChange={setSeed}
                  onRandomizeSeed={randomizeSeed}
                  playbackFps={playbackFps}
                  onPlaybackFpsChange={(fps) => {
                    setPlaybackFps(fps);
                    if (isPlaying) {
                      startPlaybackLoop();
                    }
                  }}
                  isGenerating={isGenerating}
                  hasRecordedVideo={hasRecordedVideo}
                  isPlaying={isPlaying}
                  isProcessingVideo={isProcessingVideo}
                  onToggleGeneration={toggleGeneration}
                  onTogglePlayback={togglePlayback}
                  onDownloadVideo={downloadVideo}
                />
              </div>

              {/* Video Output - Takes 2 columns on the right */}
              <div className="lg:col-span-2 flex flex-col h-full">
                <VideoOutput
                  canvasRef={canvasRef}
                  frameCount={frameCount}
                  isGenerating={isGenerating}
                  isConnected={isConnected}
                  status={status}
                />
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
                  <Logo className="h-6 w-10" />
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
                  href="https://github.com/fal-ai-community/realtime-krea-wan"
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
