import { RefObject } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VideoOutputProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  frameCount: number;
  isGenerating: boolean;
  isConnected: boolean;
  status: string;
};

export function VideoOutput({
  canvasRef,
  frameCount,
  isGenerating,
  isConnected,
  status,
}: VideoOutputProps) {
  return (
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
        <div
          className={cn(
            "relative w-full bg-terminal-background border flex items-center justify-center overflow-hidden aspect-video",
            isGenerating ? "border-rainbow" : "border-border-default"
          )}
        >
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
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
              <span className="text-xs font-mono text-red-400">GENERATING</span>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
