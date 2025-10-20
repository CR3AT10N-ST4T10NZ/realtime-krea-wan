import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KonvaEditorHandle } from "@/components/canvas/KonvaEditor";
import { TextModeControls } from "@/components/TextModeControls";
import { CanvasModeControls } from "@/components/CanvasModeControls";
import { WebcamModePreview } from "@/components/WebcamModePreview";
import { Download, Dices, Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ControlsPanelProps = {
  // Mode
  mode: "text" | "canvas" | "webcam";
  onModeChange: (mode: "text" | "canvas" | "webcam") => void;

  // Prompt
  prompt: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSurpriseMe: () => void;

  // Canvas/Webcam
  konvaRef: RefObject<KonvaEditorHandle | null>;
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  webcamStream: MediaStream | null;
  width: number;
  height: number;
  hasActiveWebcam: boolean;
  onShapesChange: (shapes: any[]) => void;
  onAddWebcam: () => void;
  onImageUpload: () => void;

  // Controls
  strength: number;
  onStrengthChange: (value: number) => void;
  seed: string;
  onSeedChange: (value: string) => void;
  onRandomizeSeed: () => void;

  // Actions
  isGenerating: boolean;
  hasRecordedVideo: boolean;
  isPlaying: boolean;
  isProcessingVideo: boolean;
  onToggleGeneration: () => void;
  onTogglePlayback: () => void;
  onDownloadVideo: () => void;
};

export function ControlsPanel({
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onSurpriseMe,
  konvaRef,
  webcamVideoRef,
  webcamStream,
  width,
  height,
  hasActiveWebcam,
  onShapesChange,
  onAddWebcam,
  onImageUpload,
  strength,
  onStrengthChange,
  seed,
  onSeedChange,
  onRandomizeSeed,
  isGenerating,
  hasRecordedVideo,
  isPlaying,
  isProcessingVideo,
  onToggleGeneration,
  onTogglePlayback,
  onDownloadVideo,
}: ControlsPanelProps) {
  return (
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
        {/* Mode Tabs */}
        <Tabs
          value={mode}
          onValueChange={(value) =>
            onModeChange(value as "text" | "canvas" | "webcam")
          }
          className="w-full"
        >
          <TabsList className="w-full border border-border-default">
            <TabsTrigger
              value="webcam"
              disabled={isGenerating}
              className="flex-1"
            >
              WEBCAM
            </TabsTrigger>
            <TabsTrigger
              value="canvas"
              disabled={isGenerating}
              className="flex-1"
            >
              CANVAS
            </TabsTrigger>
            <TabsTrigger
              value="text"
              disabled={isGenerating}
              className="flex-1"
            >
              TEXT
            </TabsTrigger>
          </TabsList>

          {/* Webcam Mode */}
          <TabsContent value="webcam" className="space-y-4 mt-4">
            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-text-muted font-mono">
                  PROMPT
                  {isGenerating && (
                    <span className="ml-2 text-green-400">(LIVE UPDATES)</span>
                  )}
                </label>
                <Button
                  onClick={onSurpriseMe}
                  variant="default"
                  size="sm"
                  className="text-xs font-mono"
                >
                  <Dices className="w-3 h-3 mr-1" />
                  SURPRISE ME
                </Button>
              </div>
              <textarea
                value={prompt}
                onChange={onPromptChange}
                className="w-full px-3 py-2.5 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition resize-none text-sm font-mono text-text-primary disabled:opacity-50"
                rows={3}
                placeholder="Describe what you want to generate..."
              />
              <p className="text-xs text-text-muted mt-1 font-mono">
                Changes update in real-time while generating
              </p>
            </div>

            {/* Webcam Preview */}
            <WebcamModePreview
              webcamVideoRef={webcamVideoRef}
              webcamStream={webcamStream}
              width={width}
              height={height}
            />

            {/* Strength */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
                STRENGTH: {strength.toFixed(2)}
              </label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[strength]}
                onValueChange={(value) => onStrengthChange(value[0])}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1 font-mono">
                Transformation strength
              </p>
            </div>
          </TabsContent>

          {/* Canvas Mode */}
          <TabsContent value="canvas" className="space-y-4 mt-4">
            <CanvasModeControls
              prompt={prompt}
              onPromptChange={onPromptChange}
              onSurpriseMe={onSurpriseMe}
              isGenerating={isGenerating}
              konvaRef={konvaRef}
              width={width}
              height={height}
              strength={strength}
              onStrengthChange={onStrengthChange}
              hasActiveWebcam={hasActiveWebcam}
              onShapesChange={onShapesChange}
              onAddWebcam={onAddWebcam}
              onImageUpload={onImageUpload}
            />
          </TabsContent>

          {/* Text Mode */}
          <TabsContent value="text" className="space-y-4 mt-4">
            <TextModeControls
              prompt={prompt}
              onPromptChange={onPromptChange}
              onSurpriseMe={onSurpriseMe}
              isGenerating={isGenerating}
            />
          </TabsContent>
        </Tabs>

        {/* Common Controls (shown for all modes) */}

        {/* Seed */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
            SEED (OPTIONAL)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={seed}
              onChange={(e) => onSeedChange(e.target.value)}
              placeholder="random"
              disabled={isGenerating}
              className="flex-1 px-3 py-2 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none text-sm font-mono text-text-primary disabled:opacity-50"
            />
            <Button
              onClick={onRandomizeSeed}
              disabled={isGenerating}
              variant="default"
              className="px-4 py-2 text-sm font-mono"
            >
              <Dices className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 justify-end">
          {/* Play Button - appears when frames are ready */}
          {hasRecordedVideo && (
            <Button
              onClick={onTogglePlayback}
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
            onClick={onToggleGeneration}
            className="flex-1 py-3 text-sm font-bold font-mono flex items-center justify-between"
            variant={isGenerating ? "red" : "blue"}
          >
            <span>{isGenerating ? "[ STOP ]" : "[ START ]"}</span>
            <span className="flex items-center gap-1 text-xs opacity-70">
              <kbd
                className={cn(
                  "px-1.5 py-0.5 bg-black/20 border rounded-none text-[10px]",
                  isGenerating ? "border-red-500/40" : "border-blue-500/40"
                )}
              >
                ⌘
              </kbd>
              <kbd
                className={cn(
                  "px-1.5 py-0.5 bg-black/20 border rounded-none text-[10px]",
                  isGenerating ? "border-red-500/40" : "border-blue-500/40"
                )}
              >
                ↵
              </kbd>
            </span>
          </Button>

          <Button
            onClick={onDownloadVideo}
            disabled={!hasRecordedVideo || isProcessingVideo}
            variant="default"
            className="px-4 py-3 font-mono"
            title={isProcessingVideo ? "Processing video..." : "Download video"}
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
  );
}
