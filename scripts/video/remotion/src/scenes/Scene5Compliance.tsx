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
 * Scene 5 — "Compliance section"
 * Hub compliance text. Adds three small badge chips beside the browser frame
 * so the spoken claims (AU region, APP, Microsoft 365) have visible anchors.
 */
export const Scene5Compliance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const browserIn = spring({
    frame,
    fps,
    config: { stiffness: 200, mass: 0.55 },
    durationInFrames: 10,
  });
  const badgeIn = (i: number) =>
    spring({
      frame: frame - 10 - i * 6,
      fps,
      config: { stiffness: 220, mass: 0.5 },
      durationInFrames: 10,
    });

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
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          padding: "0 96px",
        }}
      >
        {/* Left: browser frame */}
        <div
          style={{
            opacity: browserIn,
            transform: `scale(${0.92 + browserIn * 0.08 + (zoom - 1) * 0.5})`,
            flex: "0 0 auto",
          }}
        >
          <BrowserFrame
            url="smecai.sharepoint.com/sites/AIApplications/SitePages/Reception-Hub.aspx"
            width={1080}
          >
            <div
              style={{
                position: "relative",
                width: 1080,
                height: 600,
                overflow: "hidden",
                background: "#FFFFFF",
              }}
            >
              <Img
                src={staticFile("screenshots/04-hub-compliance.png")}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 1080,
                  height: "auto",
                  display: "block",
                }}
              />
            </div>
          </BrowserFrame>
        </div>

        {/* Right: chip stack */}
        <div
          style={{
            flex: "0 0 460px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
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
              opacity: badgeIn(-1),
            }}
          >
            03 — Compliance
          </div>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 52,
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: -1,
              lineHeight: 1.05,
              opacity: badgeIn(-1),
            }}
          >
            Inside your tenant.
          </div>
          <Badge in={badgeIn(0)}>Australian Privacy Principles</Badge>
          <Badge in={badgeIn(1)}>Australia East region</Badge>
          <Badge in={badgeIn(2)}>Microsoft 365 boundary</Badge>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ in: number; children: React.ReactNode }> = ({
  in: progress,
  children,
}) => (
  <div
    style={{
      opacity: progress,
      transform: `translateX(${(1 - progress) * -40}px)`,
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 18,
      padding: "20px 28px",
      fontFamily: font.body,
      fontSize: 26,
      fontWeight: 600,
      color: colors.textPrimary,
      boxShadow: "0 16px 30px rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: colors.accentSolid,
        boxShadow: `0 0 12px ${colors.accentSolid}`,
      }}
    />
    {children}
  </div>
);
