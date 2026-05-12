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
 * Scene 3 — "Inbox section"
 * The hub page Inbox view. Caption overlay calls out the work pattern.
 * Slow zoom-in (Ken Burns) on the screenshot so it doesn't feel static.
 */
export const Scene3Inbox: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const browserIn = spring({
    frame,
    fps,
    config: { stiffness: 200, mass: 0.55 },
    durationInFrames: 10,
  });
  const captionIn = spring({
    frame: frame - 6,
    fps,
    config: { stiffness: 220, mass: 0.5 },
    durationInFrames: 10,
  });

  // Slow zoom in over the scene
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, durationInFrames], [0, -40], {
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
        {/* Top caption */}
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
            01 — Inbox
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
            One screen. Grouped by status.
          </div>
        </div>

        {/* Browser frame */}
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
                src={staticFile("screenshots/02-hub-inbox.png")}
                style={{
                  position: "absolute",
                  top: panY,
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
