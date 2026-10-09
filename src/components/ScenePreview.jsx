import React, { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { dimensions, pixelValue } from "../../shared/schema.js";

/** A schematic still of the selected scene, drawn at the video's real pixel size. */
export function ScenePreview({ movie, scene }) {
  const [W, H] = dimensions(movie),
    ref = useRef(null),
    [scale, setScale] = useState(0.28);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(entry.contentRect.width / W, entry.contentRect.height / H),
      ),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [W, H]);
  return (
    <div ref={ref} className="scene-preview-frame">
      <div
        className="scene-preview"
        key={`${W}x${H}`}
        style={{
          width: W * scale,
          height: H * scale,
          background: scene["background-color"],
        }}
      >
        <div
          className="scene-canvas"
          style={{ width: W, height: H, transform: `scale(${scale})` }}
        >
          {scene.elements
            .filter(
              (e) =>
                ["text", "subtitles", "image", "video"].includes(e.type) &&
                e.start === 0,
            )
            .map((e, i) => {
              const textElement = ["text", "subtitles"].includes(e.type);
              const width = e.width || (textElement ? W * 0.88 : W),
                height = e.height || (textElement ? undefined : H);
              const left =
                pixelValue(e.x, W) !== undefined
                  ? pixelValue(e.x, W)
                  : e.x === "right"
                    ? W - width
                    : e.x === "left"
                      ? 0
                      : W / 2;
              const top =
                pixelValue(e.y, H) !== undefined
                  ? pixelValue(e.y, H)
                  : e.y === "bottom"
                    ? H
                    : e.y === "top"
                      ? 0
                      : H / 2;
              const transform = `translate(${e.x === "center" ? "-50%" : "0"},${e.y === "center" ? "-50%" : e.y === "bottom" ? "-100%" : "0"})`;
              const style = {
                position: "absolute",
                left,
                top,
                width,
                height,
                transform,
                color: e.color,
                fontSize: e["font-size"],
                fontWeight: e["font-weight"],
                fontFamily:
                  e["font-family"] === "Poppins"
                    ? '"Poppins ExtraBold", "DM Sans", sans-serif'
                    : undefined,
                textAlign: e["text-align"],
                lineHeight: 1.25,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                textShadow: e.style === "shadow" ? "0 2px 5px #111" : undefined,
              };
              return textElement ? (
                <div key={i} style={style}>
                  {e.type === "subtitles"
                    ? e.text.split(/\s+/).slice(0, 6).join(" ")
                    : e.text}
                </div>
              ) : e.type === "image" && e.src ? (
                <img
                  key={i}
                  alt="Image from the scene"
                  src={e.src}
                  referrerPolicy="no-referrer"
                  style={{ ...style, objectFit: e.fit }}
                />
              ) : (
                <div key={i} className="video-placeholder" style={style}>
                  <Film size={60} strokeWidth={1.4} />
                  <span>
                    {e.type === "image"
                      ? "FLUX image, generated at render time"
                      : "Video clip, visible after rendering"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
