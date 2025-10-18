import { useCallback, useRef, useState } from "react";
import { msgpackEncode } from "@/lib/msgpack";

const TOKEN_EXPIRATION_SECONDS = 5000;

type WebSocketParams = {
  appAlias: string;
  onFrameReceived: (data: ArrayBuffer | Blob) => void;
  onConnectionStateChange?: (connected: boolean) => void;
};

type SendParamsOptions = {
  prompt: string;
  width: number;
  height: number;
  numBlocks: number;
  seed: string;
  strength: number;
  mode: "text" | "canvas" | "webcam";
  startFrame: Uint8Array | null;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
};

export function useWebSocket({
  appAlias,
  onFrameReceived,
  onConnectionStateChange,
}: WebSocketParams) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const frameExtractionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTemporaryToken = async (appAlias: string): Promise<string> => {
    try {
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

  // Stop frame extraction
  const stopFrameExtraction = useCallback(() => {
    if (frameExtractionIntervalRef.current) {
      clearInterval(frameExtractionIntervalRef.current);
      frameExtractionIntervalRef.current = null;
    }
  }, []);

  // Start frame extraction
  const startFrameExtraction = useCallback(
    (
      inputFps: number,
      extractFrameBytes: () => Promise<Uint8Array | null>,
      params: { strength: number; prompt: string; numBlocks: number }
    ) => {
      const intervalMs = Math.floor(1000 / inputFps);

      frameExtractionIntervalRef.current = setInterval(async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log("WebSocket not open, stopping frame extraction");
          stopFrameExtraction();
          return;
        }

        const frameBytes = await extractFrameBytes();

        if (!frameBytes || frameBytes.length === 0) {
          console.warn("Empty frame, skipping");
          return;
        }

        const message = {
          image: frameBytes,
          strength: params.strength,
          prompt: params.prompt,
          num_blocks: params.numBlocks,
          timestamp: Date.now(),
        };

        const encoded = msgpackEncode(message);
        wsRef.current.send(encoded);
      }, intervalMs);
    },
    [stopFrameExtraction]
  );

  // Send initial parameters
  const createSendParams = useCallback(
    (
      options: SendParamsOptions,
      callbacks: {
        clearCanvas: () => void;
        startRecording: () => void;
        startPlaybackLoop: () => void;
        updateLastFrameTime: () => void;
        extractFrameBytes: () => Promise<Uint8Array | null>;
        startFrameExtraction: (inputFps: number) => void;
        setIsGenerating: (value: boolean) => void;
      }
    ) => {
      return async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setStatus("WebSocket not connected");
          callbacks.setIsGenerating(false);
          return false;
        }

        const trimmedPrompt = options.prompt.trim();
        if (!trimmedPrompt) {
          setStatus("Please enter a prompt before starting");
          callbacks.setIsGenerating(false);
          if (wsRef.current) {
            wsRef.current.close(1000, "missing prompt");
          }
          return false;
        }

        const payload: {
          prompt: string;
          num_blocks: number;
          num_denoising_steps: number;
          strength: number;
          width?: number;
          height?: number;
          seed?: number;
          start_frame?: Uint8Array;
        } = {
          prompt: trimmedPrompt,
          num_blocks: options.numBlocks,
          num_denoising_steps: 4,
          strength: options.strength,
        };

        // Add dimensions for text or canvas mode
        if (options.mode === "text" || options.mode === "canvas") {
          const normalizedWidth = Math.max(
            64,
            Math.round(options.width / 8) * 8
          );
          const normalizedHeight = Math.max(
            64,
            Math.round(options.height / 8) * 8
          );

          if (normalizedWidth !== options.width)
            options.onWidthChange(normalizedWidth);
          if (normalizedHeight !== options.height)
            options.onHeightChange(normalizedHeight);

          payload.width = normalizedWidth;
          payload.height = normalizedHeight;
        }

        const trimmedSeed = options.seed.trim();
        if (trimmedSeed === "") {
          payload.seed = Math.floor(Math.random() * (1 << 24));
        } else {
          const numericSeed = Number(trimmedSeed);
          if (!isNaN(numericSeed) && isFinite(numericSeed)) {
            payload.seed = Math.floor(numericSeed);
          }
        }

        // Add start frame for canvas or webcam mode
        if (options.mode === "canvas" || options.mode === "webcam") {
          if (options.startFrame) {
            payload.start_frame = options.startFrame;
            console.log(
              `Start frame extracted from ${options.mode}:`,
              options.startFrame.length,
              "bytes"
            );
          } else {
            setStatus(`Failed to extract start frame from ${options.mode}`);
            callbacks.setIsGenerating(false);
            if (wsRef.current) {
              wsRef.current.close(1000, "missing start frame");
            }
            return false;
          }
        }

        callbacks.clearCanvas();
        callbacks.startRecording();
        callbacks.startPlaybackLoop();
        callbacks.updateLastFrameTime();

        try {
          const encoded = msgpackEncode(payload);
          wsRef.current.send(encoded);
          setStatus("Generation started");
          console.log("Sent initial params:", {
            ...payload,
            start_frame: payload.start_frame
              ? `[${payload.start_frame.length} bytes]`
              : undefined,
          });

          // Start frame extraction for canvas/webcam modes
          if (options.mode === "canvas" || options.mode === "webcam") {
            setTimeout(() => callbacks.startFrameExtraction(12), 500);
          }

          return true;
        } catch (error) {
          console.error("Failed to send parameters:", error);
          setStatus(`Failed to send parameters: ${error}`);
          callbacks.setIsGenerating(false);
          if (wsRef.current) {
            wsRef.current.close(1000, "send failed");
          }
          return false;
        }
      };
    },
    []
  );

  // Connect to WebSocket
  const connect = useCallback(
    async (
      sendParamsCallback: () => Promise<boolean>,
      onStopCallbacks: {
        stopPlaybackLoop: () => void;
        stopRecording: () => void;
        setIsGenerating: (value: boolean) => void;
      }
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setStatus("Already connected");
        return;
      }

      setStatus("Fetching authentication token...");
      let token;
      try {
        token = await fetchTemporaryToken(appAlias);
      } catch (error) {
        console.error("Failed to fetch JWT token:", error);
        setStatus(`Auth failed: ${error}`);
        return;
      }

      setStatus("Connecting to WebSocket...");
      const encodedToken = encodeURIComponent(token);
      const wsUrl = `wss://fal.run/fal-ai/${appAlias}/ws?fal_jwt_token=${encodedToken}`;

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
              const success = await sendParamsCallback();
              if (success) {
                setIsConnected(true);
                onConnectionStateChange?.(true);
              }
            } else if (data.error) {
              setStatus(`Server error: ${JSON.stringify(data.error)}`);
              console.error("Server validation error:", data.error);
              onStopCallbacks.setIsGenerating(false);
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
          onFrameReceived(event.data);
        } else if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          onFrameReceived(arrayBuffer);
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

        setStatus(
          `Disconnected: ${event.reason || closeReasons[event.code] || "Unknown"} (${event.code})`
        );
        setIsConnected(false);
        onConnectionStateChange?.(false);
        onStopCallbacks.setIsGenerating(false);
        onStopCallbacks.stopPlaybackLoop();
        stopFrameExtraction();
        setTimeout(() => onStopCallbacks.stopRecording(), 500);
        wsRef.current = null;
      };

      wsRef.current = ws;
    },
    [appAlias, onFrameReceived, onConnectionStateChange, stopFrameExtraction]
  );

  // Disconnect WebSocket
  const disconnect = useCallback(
    (reason = "stopped by user") => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, reason);
      }
      stopFrameExtraction();
    },
    [stopFrameExtraction]
  );

  // Send prompt update
  const sendPromptUpdate = useCallback(
    (newPrompt: string, numBlocks: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && isConnected) {
        const update = {
          prompt: newPrompt,
          num_blocks: numBlocks,
        };
        wsRef.current.send(msgpackEncode(update));
        console.log("Sent prompt update:", newPrompt);
      }
    },
    [isConnected]
  );

  // Cleanup
  const cleanup = useCallback(() => {
    if (textDebounceRef.current) {
      clearTimeout(textDebounceRef.current);
    }
    stopFrameExtraction();
  }, [stopFrameExtraction]);

  return {
    isConnected,
    status,
    connect,
    disconnect,
    sendPromptUpdate,
    createSendParams,
    startFrameExtraction,
    stopFrameExtraction,
    textDebounceRef,
    cleanup,
    setStatus,
  };
}
