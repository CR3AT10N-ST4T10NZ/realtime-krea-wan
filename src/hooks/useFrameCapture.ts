import { useCallback, useRef, useState } from "react";
import type { KonvaEditorHandle } from "@/components/canvas/KonvaEditor";

export function useFrameCapture(playbackFps: number) {
  const [hasRecordedVideo, setHasRecordedVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameBufferRef = useRef<ImageBitmap[]>([]);
  const storedFramesRef = useRef<Blob[]>([]);
  const lastFrameTimeRef = useRef<number | null>(null);
  const playbackLoopRef = useRef<NodeJS.Timeout | null>(null);
  const playbackFrameIndexRef = useRef<number>(0);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const extractFrameBytes = useCallback(
    async (
      mode: "text" | "canvas" | "webcam",
      konvaRef: React.RefObject<KonvaEditorHandle | null>,
      webcamVideoRef: React.RefObject<HTMLVideoElement | null>
    ): Promise<Uint8Array | null> => {
      if (mode === "canvas") {
        if (
          !konvaRef.current ||
          typeof konvaRef.current.toDataURL !== "function"
        ) {
          console.error("[Canvas] Konva ref not ready");
          return null;
        }

        try {
          const dataUrl = konvaRef.current.toDataURL();
          if (!dataUrl) {
            console.error("[Canvas] Konva toDataURL returned null or empty");
            return null;
          }

          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);

          if (bytes.length === 0) {
            console.error("[Canvas] Extracted 0 bytes from Konva");
            return null;
          }

          return bytes;
        } catch (e) {
          console.error("Failed to extract canvas bytes:", e);
          return null;
        }
      } else if (mode === "webcam") {
        // Webcam mode
        const video = webcamVideoRef.current;
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          console.error("[Webcam] Video not ready");
          return null;
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.error("[Webcam] Failed to get canvas context");
            return null;
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);

          if (bytes.length === 0) {
            console.error("[Webcam] Extracted 0 bytes from video");
            return null;
          }

          return bytes;
        } catch (e) {
          console.error("Failed to extract webcam bytes:", e);
          return null;
        }
      }

      // Text mode - no frame extraction needed
      return null;
    },
    []
  );

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

  // Start recording
  const startRecording = useCallback(() => {
    storedFramesRef.current = [];
    setHasRecordedVideo(false);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (storedFramesRef.current.length > 0) {
      setHasRecordedVideo(true);
    }
  }, []);

  // Play stored frames
  const playStoredFrames = useCallback(() => {
    if (storedFramesRef.current.length === 0 || !canvasRef.current) return;

    setIsPlaying(true);
    playbackFrameIndexRef.current = 0;

    const renderFrame = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const frameIndex = playbackFrameIndexRef.current;
      if (frameIndex >= storedFramesRef.current.length) {
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

    const frameInterval = 1000 / playbackFps;
    playbackLoopRef.current = setInterval(renderFrame, frameInterval);
    renderFrame();
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

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playStoredFrames();
    }
  }, [isPlaying, stopPlayback, playStoredFrames]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    frameBufferRef.current = [];
  }, []);

  return {
    canvasRef,
    hasRecordedVideo,
    isPlaying,
    frameCount,
    storedFrames: storedFramesRef,
    lastFrameTime: lastFrameTimeRef,
    extractFrameBytes,
    displayFrame,
    startPlaybackLoop,
    stopPlaybackLoop,
    startRecording,
    stopRecording,
    togglePlayback,
    clearCanvas,
    setFrameCount,
  };
}
