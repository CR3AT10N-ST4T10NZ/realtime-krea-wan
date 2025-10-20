import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import KonvaEditor, {
  KonvaEditorHandle,
} from "@/components/canvas/KonvaEditor";
import { Camera, Upload, Dices } from "lucide-react";

type CanvasModeControlsProps = {
  prompt: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSurpriseMe: () => void;
  isGenerating: boolean;
  konvaRef: RefObject<KonvaEditorHandle | null>;
  width: number;
  height: number;
  strength: number;
  onStrengthChange: (value: number) => void;
  hasActiveWebcam: boolean;
  onShapesChange: (shapes: any[]) => void;
  onAddWebcam: () => void;
  onImageUpload: () => void;
};

export function CanvasModeControls({
  prompt,
  onPromptChange,
  onSurpriseMe,
  isGenerating,
  konvaRef,
  width,
  height,
  strength,
  onStrengthChange,
  hasActiveWebcam,
  onShapesChange,
  onAddWebcam,
  onImageUpload,
}: CanvasModeControlsProps) {
  return (
    <div className="space-y-4">
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

      {/* Canvas Editor */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
          CANVAS EDITOR
        </label>

        {/* Shape Toolbar */}
        <div className="flex gap-2 mb-2 flex-wrap">
          <Button
            onClick={() => konvaRef.current?.addRect()}
            variant="default"
            size="sm"
            className="text-xs font-mono"
          >
            + RECTANGLE
          </Button>
          <Button
            onClick={() => konvaRef.current?.addCircle()}
            variant="default"
            size="sm"
            className="text-xs font-mono"
          >
            + CIRCLE
          </Button>
          <Button
            onClick={() => konvaRef.current?.addText()}
            variant="default"
            size="sm"
            className="text-xs font-mono"
          >
            + TEXT
          </Button>
          <Button
            onClick={onAddWebcam}
            disabled={hasActiveWebcam}
            variant={hasActiveWebcam ? "red" : "default"}
            size="sm"
            className="text-xs font-mono"
          >
            <Camera className="w-3 h-3 mr-1" />
            {hasActiveWebcam ? "WEBCAM ACTIVE" : "WEBCAM"}
          </Button>
          <Button
            onClick={onImageUpload}
            variant="default"
            size="sm"
            className="text-xs font-mono"
          >
            <Upload className="w-3 h-3 mr-1" />
            IMAGE
          </Button>
        </div>

        <KonvaEditor
          ref={konvaRef as any}
          width={width}
          height={height}
          onChange={onShapesChange}
        />
        <p className="text-xs text-text-muted mt-1 font-mono">
          Click to select, drag to move, resize with handles. Delete / Cmd+C /
          Cmd+V supported.
        </p>
      </div>

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
    </div>
  );
}
