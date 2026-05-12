import React from "react";
import { Img, staticFile, useCurrentFrame, spring, useVideoConfig } from "remotion";

/**
 * Persistent SMEC AI logo watermark, lower-right corner, on every frame.
 * Subtle (opacity 0.55) so it doesn't compete with scene content.
 */
export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = spring({
    frame: frame - 12,
    fps,
    config: { stiffness: 120, mass: 0.6 },
    durationInFrames: 20,
  });
  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 36,
        opacity: 0.55 * fadeIn,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <Img
        src={staticFile("logos/smec-ai-logo-white.png")}
        style={{ width: 180, height: "auto", display: "block" }}
      />
    </div>
  );
};
