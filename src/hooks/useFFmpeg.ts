import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useCallback, useRef, useState } from "react";

export function useFFmpeg() {
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

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

  const exportVideo = useCallback(
    async (frames: Blob[], fps: number): Promise<Blob> => {
      if (frames.length === 0) {
        throw new Error("No frames to export");
      }

      setIsProcessingVideo(true);

      try {
        const ffmpeg = await loadFFmpeg();
        if (!ffmpeg) {
          throw new Error("Failed to load FFmpeg");
        }

        console.log(`Encoding ${frames.length} frames at ${fps}fps`);

        // Write all frames to FFmpeg filesystem
        for (let i = 0; i < frames.length; i++) {
          const frameData = await fetchFile(frames[i]);
          ffmpeg.writeFile(
            `frame${i.toString().padStart(5, "0")}.jpg`,
            frameData
          );
        }

        // Run FFmpeg encoding
        await ffmpeg.exec([
          "-framerate",
          fps.toString(),
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

        // Read the output
        const data = await ffmpeg.readFile("output.mp4");

        // Cleanup
        for (let i = 0; i < frames.length; i++) {
          try {
            await ffmpeg.deleteFile(
              `frame${i.toString().padStart(5, "0")}.jpg`
            );
          } catch {}
        }
        try {
          await ffmpeg.deleteFile("output.mp4");
        } catch {}

        const videoData = new Uint8Array(data as Uint8Array);
        const blob = new Blob([videoData.buffer], { type: "video/mp4" });

        console.log("Video exported successfully");
        return blob;
      } catch (error) {
        console.error("Failed to create video:", error);
        throw error;
      } finally {
        setIsProcessingVideo(false);
      }
    },
    [loadFFmpeg]
  );

  return {
    loadFFmpeg,
    exportVideo,
    isProcessingVideo,
  };
}
