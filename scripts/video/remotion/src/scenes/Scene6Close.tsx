import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { Background } from "../components/Background";
import { colors, font, brand } from "../lib/branding";

/**
 * Scene 6 — "Close"
 * SMEC AI logo (large) above the product name. Tagline below an accent line.
 */
export const Scene6Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({
    frame,
    fps,
    config: { stiffness: 200, mass: 0.55 },
    durationInFrames: 14,
  });
  const productIn = spring({
    frame: frame - 10,
    fps,
    config: { stiffness: 200, mass: 0.5 },
    durationInFrames: 12,
  });
  const lineIn = spring({
    frame: frame - 22,
    fps,
    config: { stiffness: 180, mass: 0.6 },
    durationInFrames: 14,
  });
  const taglineIn = spring({
    frame: frame - 32,
    fps,
    config: { stiffness: 200, mass: 0.5 },
    durationInFrames: 10,
  });

  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          textAlign: "center",
        }}
      >
        {/* SMEC AI logo */}
        <div
          style={{
            opacity: logoIn,
            transform: `translateY(${(1 - logoIn) * 20}px) scale(${0.92 + logoIn * 0.08})`,
            filter: `drop-shadow(0 0 30px ${colors.accentSolid}55)`,
          }}
        >
          <Img
            src={staticFile("logos/smec-ai-logo-white.png")}
            style={{ width: 540, height: "auto", display: "block" }}
          />
        </div>

        {/* Product name */}
        <div
          style={{
            fontFamily: font.display,
            fontSize: 64,
            fontWeight: 700,
            color: colors.textPrimary,
            letterSpacing: -1.2,
            lineHeight: 1.0,
            opacity: productIn,
            transform: `translateY(${(1 - productIn) * 20}px)`,
          }}
        >
          Reception Inbox Auditor
        </div>

        {/* Accent line */}
        <div
          style={{
            width: 320 * lineIn,
            height: 4,
            background: colors.accent,
            borderRadius: 2,
            transformOrigin: "left",
            boxShadow: `0 0 18px ${colors.accentSolid}88`,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontFamily: font.body,
            fontSize: 36,
            fontWeight: 500,
            color: colors.textSecondary,
            letterSpacing: 0.3,
            opacity: taglineIn,
            transform: `translateY(${(1 - taglineIn) * 16}px)`,
            fontStyle: "italic",
          }}
        >
          {brand.tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
};
