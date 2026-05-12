import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { colors, font } from "../lib/branding";

/**
 * Scene 4 — "Stats section"
 * Hub stats — pie chart + totals.
 */
export const Scene4Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const browserIn = spring({
    frame,
    fps,
    config: { stiffness: 200, mass: 0.55 },
    durationInFrames: 10,
  });
  const captionIn = spring({
    frame: frame - 5,
    fps,
    config: { stiffness: 220, mass: 0.5 },
    durationInFrames: 10,
  });

  // Slow push-in
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.04], {
    extrapolateRight: "clamp",
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
          gap: 32,
          padding: "0 96px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: captionIn,
            transform: `translateY(${(1 - captionIn) * -10}px)`,
          }}
        >
          <div
            style={{
              fontFamily: font.body,
              fontSize: 20,
              color: colors.accentSecondary,
              letterSpacing: 3,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            02 — Stats
          </div>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 56,
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: -1,
            }}
          >
            What's actually coming in.
          </div>
        </div>

        <div
          style={{
            opacity: browserIn,
            transform: `scale(${0.92 + browserIn * 0.08 + (zoom - 1)})`,
          }}
        >
          <BrowserFrame
            url="smecai.sharepoint.com/sites/AIApplications/SitePages/Reception-Hub.aspx"
            width={1680}
          >
            <div
              style={{
                position: "relative",
                width: 1680,
                height: 720,
                overflow: "hidden",
                background: "#FFFFFF",
              }}
            >
              <Img
                src={staticFile("screenshots/03-hub-stats.png")}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 1680,
                  height: "auto",
                  display: "block",
                }}
              />
            </div>
          </BrowserFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};
