import { useCallback, useRef, useState } from "react";

export function useWebcam() {
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamInitializedRef = useRef<boolean>(false);

  const startWebcam = useCallback(async () => {
    if (webcamInitializedRef.current) {
      console.log("Webcam already initialized, skipping");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setWebcamStream(stream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
      webcamInitializedRef.current = true;
      console.log("Webcam started successfully");
    } catch (error) {
      console.error("Failed to start webcam:", error);
      throw new Error("Failed to access webcam. Please check permissions.");
    }
  }, []);

  const stopWebcam = useCallback(() => {
    const video = webcamVideoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      setWebcamStream(null);
      webcamInitializedRef.current = false;
      console.log("Webcam stopped");
    }
  }, []);

  return {
    webcamStream,
    webcamVideoRef,
    startWebcam,
    stopWebcam,
  };
}
