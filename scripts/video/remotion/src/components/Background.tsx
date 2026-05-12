import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../lib/branding";

/**
 * Gradient-mesh background with two drifting orbs. Layer-1 of the 4-layer
 * frame. Always animating so scenes never feel static.
 */
export const Background: React.FC<{ tint?: "primary" | "negative" }> = ({
  tint = "primary",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;
  const orb1X = 30 + Math.sin(t * 0.25) * 8;
  const orb1Y = 25 + Math.cos(t * 0.18) * 6;
  const orb2X = 70 + Math.cos(t * 0.22) * 7;
  const orb2Y = 75 + Math.sin(t * 0.3) * 5;

  const bgA = tint === "negative" ? colors.negative : colors.bgPrimary;
  const bgB = tint === "negative" ? "#291832" : colors.bgSecondary;
  const accent = tint === "negative" ? colors.negativeAccent : colors.accentSolid;
  const accent2 = colors.accentSecondary;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(135deg, ${bgA} 0%, ${bgB} 100%)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "60vw",
          height: "60vw",
          left: `${orb1X}%`,
          top: `${orb1Y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${accent}55 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "50vw",
          height: "50vw",
          left: `${orb2X}%`,
          top: `${orb2Y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${accent2}33 0%, transparent 60%)`,
          filter: "blur(50px)",
        }}
      />
      {/* subtle grain via radial dots */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          opacity: 0.6,
          mixBlendMode: "overlay",
        }}
      />
      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
