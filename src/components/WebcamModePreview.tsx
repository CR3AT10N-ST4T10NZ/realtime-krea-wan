import { RefObject } from "react";

type WebcamModePreviewProps = {
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  webcamStream: MediaStream | null;
  width: number;
  height: number;
};

export function WebcamModePreview({
  webcamVideoRef,
  webcamStream,
  width,
  height,
}: WebcamModePreviewProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-2 font-mono">
        WEBCAM PREVIEW
      </label>
      <div
        className="w-full border border-border-default bg-terminal-background flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: `${width}/${height}` }}
      >
        <video
          ref={webcamVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!webcamStream && (
          <div className="absolute text-center p-4">
            <p className="text-text-muted font-mono text-xs">
              [ WAITING FOR WEBCAM ACCESS ]
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-text-muted mt-1 font-mono">
        Webcam feed will be sent directly to generation
      </p>
    </div>
  );
}
