"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Stage,
  Layer,
  Rect,
  Transformer,
  Circle,
  Text as KonvaText,
  Image as KonvaImage,
} from "react-konva";
import useImage from "use-image";

type RectShape = {
  type: "rect";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

type CircleShape = {
  type: "circle";
  id: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
};

type TextShape = {
  type: "text";
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
};

type ImageShape = {
  type: "image";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // data URL
};

type WebcamShape = {
  type: "webcam";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stream: MediaStream;
};

type Shape = RectShape | CircleShape | TextShape | ImageShape | WebcamShape;

export type KonvaEditorHandle = {
  toDataURL: () => string | null;
  addRect: () => void;
  addCircle: () => void;
  addText: () => void;
  addImage: (dataUrl: string) => void;
  addWebcam: () => Promise<void>;
  deleteSelected: () => void;
  duplicateSelected: () => void;
};

type Props = {
  width: number;
  height: number;
  initialShapes?: Shape[];
  onChange?: (shapes: Shape[]) => void;
};

// Component to render an image shape using the use-image hook
const ImageRenderer = ({
  shape,
  onDragMove,
  onSelect,
  onTransformEnd,
}: {
  shape: ImageShape;
  onDragMove: (id: string, pos: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onTransformEnd: (id: string, node: any) => void;
}) => {
  const [image] = useImage(shape.src);
  return (
    <KonvaImage
      id={shape.id}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      image={image}
      draggable
      onDragMove={(e) => onDragMove(shape.id, e.target.position())}
      onClick={() => onSelect(shape.id)}
      onTap={() => onSelect(shape.id)}
      onTransformEnd={(e) => onTransformEnd(shape.id, e.target)}
      onDragEnd={(e) => onDragMove(shape.id, e.target.position())}
    />
  );
};

// Component to render a live webcam feed
const WebcamRenderer = ({
  shape,
  onDragMove,
  onSelect,
  onTransformEnd,
}: {
  shape: WebcamShape;
  onDragMove: (id: string, pos: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onTransformEnd: (id: string, node: any) => void;
}) => {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const imageRef = useRef<any>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Create video element and set up stream
    const video = document.createElement("video");
    video.srcObject = shape.stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.play();
      setVideoElement(video);
    };

    // Animate the video frame - force layer redraw
    const animate = () => {
      if (imageRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Force the Konva layer to redraw this node
        const layer = imageRef.current.getLayer();
        if (layer) {
          layer.batchDraw();
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation after a short delay to ensure video is ready
    setTimeout(() => animate(), 100);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shape.stream]);

  // Don't render until video is ready
  if (!videoElement) {
    return null;
  }

  return (
    <KonvaImage
      ref={imageRef}
      id={shape.id}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      image={videoElement}
      draggable
      onDragMove={(e) => onDragMove(shape.id, e.target.position())}
      onClick={() => onSelect(shape.id)}
      onTap={() => onSelect(shape.id)}
      onTransformEnd={(e) => onTransformEnd(shape.id, e.target)}
      onDragEnd={(e) => onDragMove(shape.id, e.target.position())}
    />
  );
};

const KonvaEditor = forwardRef<KonvaEditorHandle, Props>(
  ({ width, height, initialShapes, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(width);
    const stageRef = useRef<any>(null);
    const layerRef = useRef<any>(null);
    const trRef = useRef<any>(null);
    const [shapes, setShapes] = useState<Shape[]>(
      initialShapes ?? [
        {
          type: "rect",
          id: "rect-1",
          x: Math.max(0, width / 2 - 50),
          y: Math.max(0, height / 2 - 50),
          width: 100,
          height: 100,
          fill: "#3b82f6",
        } as RectShape,
      ]
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
      onChange?.(shapes);
    }, [shapes, onChange]);

    // Observe container width and maintain aspect ratio for Stage height
    useEffect(() => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setContainerWidth(w);
        }
      });
      ro.observe(el);
      setContainerWidth(el.getBoundingClientRect().width || width);
      return () => ro.disconnect();
    }, [width]);

    const newId = () =>
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: () => {
          const stage = stageRef.current;
          if (!stage) return null;
          try {
            // Export at the actual width/height dimensions, not the scaled display size
            return stage.toDataURL({
              mimeType: "image/jpeg",
              quality: 0.9,
              pixelRatio: width / containerWidth,
            });
          } catch (e) {
            console.error("Failed to export Konva stage to data URL:", e);
            return null;
          }
        },
        addRect: () => {
          const stage = stageRef.current;
          const w = stage?.width?.() || width;
          const h = stage?.height?.() || height;
          const id = `rect-${newId()}`;
          const rect: RectShape = {
            type: "rect",
            id,
            x: Math.max(0, w / 2 - 50),
            y: Math.max(0, h / 2 - 50),
            width: 100,
            height: 100,
            fill: "#3b82f6",
          };
          setShapes((prev) => [...prev, rect]);
          setSelectedId(id);
        },
        addCircle: () => {
          const stage = stageRef.current;
          const w = stage?.width?.() || width;
          const h = stage?.height?.() || height;
          const id = `circle-${newId()}`;
          const circle: CircleShape = {
            type: "circle",
            id,
            x: Math.max(20, w / 2),
            y: Math.max(20, h / 2),
            radius: 50,
            fill: "#22c55e",
          };
          setShapes((prev) => [...prev, circle]);
          setSelectedId(id);
        },
        addText: () => {
          const stage = stageRef.current;
          const w = stage?.width?.() || width;
          const h = stage?.height?.() || height;
          const id = `text-${newId()}`;
          const text: TextShape = {
            type: "text",
            id,
            x: Math.max(10, w / 2 - 80),
            y: Math.max(10, h / 2 - 10),
            text: "Text",
            fontSize: 24,
            fill: "#111827",
          };
          setShapes((prev) => [...prev, text]);
          setSelectedId(id);
        },
        addImage: (dataUrl: string) => {
          const stage = stageRef.current;
          const w = stage?.width?.() || width;
          const h = stage?.height?.() || height;
          const id = `image-${newId()}`;
          const img: ImageShape = {
            type: "image",
            id,
            x: Math.max(0, w / 2 - 100),
            y: Math.max(0, h / 2 - 100),
            width: 200,
            height: 200,
            src: dataUrl,
          };
          setShapes((prev) => [...prev, img]);
          setSelectedId(id);
        },
        addWebcam: async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480 },
            });

            // Add the live webcam stream to the canvas
            const stage = stageRef.current;
            const w = stage?.width?.() || width;
            const h = stage?.height?.() || height;
            const id = `webcam-${newId()}`;
            const webcam: WebcamShape = {
              type: "webcam",
              id,
              x: Math.max(0, w / 2 - 150),
              y: Math.max(0, h / 2 - 150),
              width: 300,
              height: 225, // 4:3 aspect ratio
              stream,
            };
            setShapes((prev) => [...prev, webcam]);
            setSelectedId(id);
          } catch (error) {
            console.error("Error accessing webcam:", error);
            alert("Could not access webcam. Please check permissions.");
          }
        },
        deleteSelected: () => {
          if (!selectedId) return;
          // Stop webcam stream if deleting a webcam shape
          const shape = shapes.find((s) => s.id === selectedId);
          if (shape && shape.type === "webcam") {
            const webcamShape = shape as WebcamShape;
            webcamShape.stream.getTracks().forEach((track) => track.stop());
          }
          setShapes((prev) => prev.filter((s) => s.id !== selectedId));
          setSelectedId(null);
        },
        duplicateSelected: () => {
          if (!selectedId) return;
          const sel = shapes.find((s) => s.id === selectedId);
          if (!sel) return;
          // Don't allow duplicating webcam shapes (can't clone MediaStream)
          if (sel.type === "webcam") {
            alert(
              "Webcam feeds cannot be duplicated. Please add a new webcam instead."
            );
            return;
          }
          const id = `${sel.type}-${newId()}`;
          const copy = { ...sel, id, x: sel.x + 20, y: sel.y + 20 } as Shape;
          setShapes((prev) => [...prev, copy]);
          setSelectedId(id);
        },
      }),
      [selectedId, shapes, width, height, containerWidth]
    );

    const deselect = useCallback((e: any) => {
      // clicked on empty area - remove selection
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
      }
    }, []);

    const onDragMove = useCallback(
      (id: string, pos: { x: number; y: number }) => {
        setShapes((prev) =>
          prev.map((s) => (s.id === id ? { ...s, x: pos.x, y: pos.y } : s))
        );
      },
      []
    );

    const onTransformEnd = useCallback((id: string, node: any) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const x = node.x();
          const y = node.y();
          if (s.type === "rect") {
            const rs = s as RectShape;
            return {
              ...rs,
              x,
              y,
              width: Math.max(5, rs.width * scaleX),
              height: Math.max(5, rs.height * scaleY),
            } as RectShape;
          }
          if (s.type === "circle") {
            const cs = s as CircleShape;
            const r = Math.max(3, cs.radius * Math.max(scaleX, scaleY));
            return { ...cs, x, y, radius: r } as CircleShape;
          }
          if (s.type === "image") {
            const is = s as ImageShape;
            return {
              ...is,
              x,
              y,
              width: Math.max(10, is.width * scaleX),
              height: Math.max(10, is.height * scaleY),
            } as ImageShape;
          }
          if (s.type === "webcam") {
            const ws = s as WebcamShape;
            return {
              ...ws,
              x,
              y,
              width: Math.max(10, ws.width * scaleX),
              height: Math.max(10, ws.height * scaleY),
            } as WebcamShape;
          }
          const ts = s as TextShape;
          return {
            ...ts,
            x,
            y,
            fontSize: Math.max(6, ts.fontSize * scaleY),
          } as TextShape;
        })
      );
    }, []);

    // Keyboard: delete, copy (Cmd/Ctrl+C), paste (Cmd/Ctrl+V)
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!selectedId) return;
        if (e.key === "Delete" || e.key === "Backspace") {
          // Stop webcam stream if deleting a webcam shape
          const shape = shapes.find((s) => s.id === selectedId);
          if (shape && shape.type === "webcam") {
            const webcamShape = shape as WebcamShape;
            webcamShape.stream.getTracks().forEach((track) => track.stop());
          }
          setShapes((prev) => prev.filter((s) => s.id !== selectedId));
          setSelectedId(null);
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
          const sel = shapes.find((s) => s.id === selectedId);
          if (sel) {
            // Don't allow copying webcam shapes
            if (sel.type === "webcam") {
              alert(
                "Webcam feeds cannot be copied. Please add a new webcam instead."
              );
              return;
            }
            (window as any).__clipboardShape = sel;
          }
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
          const clip = (window as any).__clipboardShape as Shape | undefined;
          if (clip) {
            // Don't paste webcam shapes
            if (clip.type === "webcam") {
              return;
            }
            const copy: Shape = {
              ...clip,
              id: `${clip.type}-${Date.now()}`,
              x: clip.x + 20,
              y: clip.y + 20,
            };
            setShapes((prev) => [...prev, copy]);
            setSelectedId(copy.id);
          }
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [selectedId, shapes]);

    useEffect(() => {
      if (!trRef.current) return;
      const stage = stageRef.current as any;
      const layer = layerRef.current as any;
      const transformer = trRef.current as any;
      if (!stage || !layer || !transformer) return;

      const selectedNode = layer.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformer.nodes([selectedNode]);
      } else {
        transformer.nodes([]);
      }
      transformer.getLayer()?.batchDraw();
    }, [selectedId, shapes]);

    const stageHeight = Math.max(
      1,
      Math.round((containerWidth * height) / width)
    );

    return (
      <div
        ref={containerRef}
        style={{ width: "100%", aspectRatio: `${width}/${height}` }}
      >
        <Stage
          ref={stageRef}
          width={containerWidth}
          height={stageHeight}
          onMouseDown={deselect}
          onTouchStart={deselect}
          style={{
            width: "100%",
            height: "100%",
            background: "white",
            border: "1px solid var(--border-default)",
          }}
        >
          <Layer ref={layerRef}>
            {shapes.map((shape) => {
              if (shape.type === "rect") {
                const s = shape as RectShape;
                return (
                  <Rect
                    key={s.id}
                    id={s.id}
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    fill={s.fill}
                    draggable
                    onDragMove={(e) => onDragMove(s.id, e.target.position())}
                    onClick={() => setSelectedId(s.id)}
                    onTap={() => setSelectedId(s.id)}
                    onTransformEnd={(e) => onTransformEnd(s.id, e.target)}
                    onDragEnd={(e) => onDragMove(s.id, e.target.position())}
                  />
                );
              }
              if (shape.type === "circle") {
                const s = shape as CircleShape;
                return (
                  <Circle
                    key={s.id}
                    id={s.id}
                    x={s.x}
                    y={s.y}
                    radius={s.radius}
                    fill={s.fill}
                    draggable
                    onDragMove={(e) => onDragMove(s.id, e.target.position())}
                    onClick={() => setSelectedId(s.id)}
                    onTap={() => setSelectedId(s.id)}
                    onTransformEnd={(e) => onTransformEnd(s.id, e.target)}
                    onDragEnd={(e) => onDragMove(s.id, e.target.position())}
                  />
                );
              }
              if (shape.type === "image") {
                const s = shape as ImageShape;
                return (
                  <ImageRenderer
                    key={s.id}
                    shape={s}
                    onDragMove={onDragMove}
                    onSelect={setSelectedId}
                    onTransformEnd={onTransformEnd}
                  />
                );
              }
              if (shape.type === "webcam") {
                const s = shape as WebcamShape;
                return (
                  <WebcamRenderer
                    key={s.id}
                    shape={s}
                    onDragMove={onDragMove}
                    onSelect={setSelectedId}
                    onTransformEnd={onTransformEnd}
                  />
                );
              }
              const s = shape as TextShape;
              return (
                <KonvaText
                  key={s.id}
                  id={s.id}
                  x={s.x}
                  y={s.y}
                  text={s.text}
                  fontSize={s.fontSize}
                  fill={s.fill}
                  draggable
                  onDragMove={(e) => onDragMove(s.id, e.target.position())}
                  onClick={() => setSelectedId(s.id)}
                  onTap={() => setSelectedId(s.id)}
                  onTransformEnd={(e) => onTransformEnd(s.id, e.target)}
                  onDragEnd={(e) => onDragMove(s.id, e.target.position())}
                />
              );
            })}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              borderDash={[4, 4]}
              anchorSize={6}
              keepRatio={false}
            />
          </Layer>
        </Stage>
      </div>
    );
  }
);

KonvaEditor.displayName = "KonvaEditor";

export default KonvaEditor;
