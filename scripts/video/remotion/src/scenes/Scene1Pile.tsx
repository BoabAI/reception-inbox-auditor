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
 * Scene 1 — "The pile"
 * Headline left, browser frame right with Outlook screenshot. Subtle pan-up
 * scroll to imply a long inbox. Highlight pill on a buried referral.
 */
export const Scene1Pile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headlineIn = spring({
    frame,
    fps,
    config: { stiffness: 220, mass: 0.45 },
    durationInFrames: 8,
  });
  const subIn = spring({
    frame: frame - 4,
    fps,
    config: { stiffness: 220, mass: 0.5 },
    durationInFrames: 8,
  });
  const browserIn = spring({
    frame: frame - 2,
    fps,
    config: { stiffness: 180, mass: 0.6 },
    durationInFrames: 10,
  });

  // Slow pan-up on the screenshot to imply a long scrolling inbox
  const panY = interpolate(frame, [0, durationInFrames], [0, -180], {
    extrapolateRight: "clamp",
  });

  // Highlight pill appears after the narrator lands on "what gets missed"
  const highlightIn = spring({
    frame: frame - fps * 7,
    fps,
    config: { stiffness: 180, mass: 0.5 },
    durationInFrames: 12,
  });

  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          gap: 64,
        }}
      >
        {/* Left: headline column */}
        <div
          style={{
            flex: "0 0 520px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            transform: `translateX(${(1 - headlineIn) * -40}px)`,
            opacity: headlineIn,
          }}
        >
          <div
            style={{
              fontFamily: font.body,
              fontSize: 22,
              color: colors.accentSecondary,
              letterSpacing: 3,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            The reception inbox
          </div>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 78,
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            One pile.
            <br />
            <span
              style={{
                background: colors.accent,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Many priorities.
            </span>
          </div>
          <div
            style={{
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 20}px)`,
              fontFamily: font.body,
              fontSize: 26,
              color: colors.textSecondary,
              lineHeight: 1.4,
              maxWidth: 520,
            }}
          >
            Referrals, rebookings, billing, marketing — all dropping into the
            same shared mailbox.
          </div>
        </div>

        {/* Right: Outlook browser frame */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: browserIn,
            transform: `scale(${0.92 + browserIn * 0.08})`,
          }}
        >
          <BrowserFrame
            url="outlook.cloud.microsoft/mail/demonstration"
            width={1080}
          >
            <div
              style={{
                position: "relative",
                width: 1080,
                height: 580,
                overflow: "hidden",
                background: "#FFFFFF",
              }}
            >
              <Img
                src={staticFile("screenshots/01-outlook-inbox.png")}
                style={{
                  position: "absolute",
                  top: panY,
                  left: 0,
                  width: 1080,
                  height: "auto",
                  display: "block",
                }}
              />
              {/* Highlight pill: pulses around a buried referral */}
              <div
                style={{
                  position: "absolute",
                  bottom: 90,
                  left: 220,
                  width: 740,
                  height: 56,
                  borderRadius: 8,
                  border: `2px solid ${colors.negativeAccent}`,
                  background: `${colors.negativeAccent}22`,
                  opacity: highlightIn,
                  boxShadow: `0 0 24px ${colors.negativeAccent}88`,
                  pointerEvents: "none",
                }}
              />
            </div>
          </BrowserFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};
