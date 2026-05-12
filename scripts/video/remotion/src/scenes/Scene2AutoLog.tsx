import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Background } from "../components/Background";
import {
  OutlookLogo,
  AzureAILogo,
  SharePointLogo,
  AustraliaPill,
} from "../components/ProductLogo";
import { colors, font } from "../lib/branding";

/**
 * Scene 2 — "Auto-log"
 * Three-node flow: Outlook -> Azure AI (AU region pill) -> SharePoint.
 * Pulse animation on the arrows shows data moving.
 */
export const Scene2AutoLog: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({
    frame,
    fps,
    config: { stiffness: 220, mass: 0.45 },
    durationInFrames: 8,
  });

  const nodeIn = (delay: number) =>
    spring({
      frame: frame - delay,
      fps,
      config: { stiffness: 180, mass: 0.5 },
      durationInFrames: 10,
    });

  // Cyclic pulse: 0..1..0..1 along the arrows
  const pulseT = ((frame / fps) % 2.4) / 2.4;
  const pulsePosArrow1 = pulseT;
  const pulsePosArrow2 = ((pulseT + 0.5) % 1);

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
          padding: "0 96px",
          gap: 80,
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * -20}px)`,
            textAlign: "center",
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
              marginBottom: 16,
            }}
          >
            Auto-log
          </div>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 68,
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.05,
              letterSpacing: -1.2,
            }}
          >
            Every email, classified in <em style={{ fontStyle: "normal", background: colors.accent, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Australia</em>.
          </div>
        </div>

        {/* Flow row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            width: "100%",
            maxWidth: 1500,
            justifyContent: "space-between",
          }}
        >
          <FlowNode
            label="Microsoft 365"
            sub="Shared mailbox"
            scale={nodeIn(2)}
          >
            <OutlookLogo size={140} />
          </FlowNode>

          <FlowArrow pulsePosition={pulsePosArrow1} delay={6} frame={frame} fps={fps} />

          <FlowNode
            label="Azure OpenAI"
            sub="Referral or Other"
            scale={nodeIn(8)}
            extra={<AustraliaPill />}
          >
            <AzureAILogo size={140} />
          </FlowNode>

          <FlowArrow pulsePosition={pulsePosArrow2} delay={14} frame={frame} fps={fps} />

          <FlowNode
            label="SharePoint"
            sub="One source of truth"
            scale={nodeIn(16)}
          >
            <SharePointLogo size={140} />
          </FlowNode>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FlowNode: React.FC<{
  label: string;
  sub: string;
  children: React.ReactNode;
  scale: number;
  extra?: React.ReactNode;
}> = ({ label, sub, children, scale, extra }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 18,
      opacity: scale,
      transform: `scale(${0.7 + scale * 0.3})`,
    }}
  >
    <div
      style={{
        position: "relative",
        width: 220,
        height: 220,
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
        backdropFilter: "blur(20px)",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
      }}
    >
      {children}
      {extra}
    </div>
    <div
      style={{
        textAlign: "center",
        fontFamily: font.body,
        fontSize: 24,
        fontWeight: 700,
        color: colors.textPrimary,
      }}
    >
      {label}
    </div>
    <div
      style={{
        textAlign: "center",
        fontFamily: font.body,
        fontSize: 18,
        color: colors.textSecondary,
        marginTop: -10,
      }}
    >
      {sub}
    </div>
  </div>
);

const FlowArrow: React.FC<{
  pulsePosition: number;
  delay: number;
  frame: number;
  fps: number;
}> = ({ pulsePosition, delay, frame, fps }) => {
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 180, mass: 0.5 },
    durationInFrames: 8,
  });

  const width = 200;
  return (
    <div
      style={{
        flex: "0 0 auto",
        width,
        height: 60,
        position: "relative",
        opacity,
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Track */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 12,
          height: 2,
          background: "rgba(255,255,255,0.18)",
          transform: "translateY(-50%)",
        }}
      />
      {/* Arrowhead */}
      <div
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderLeft: `12px solid rgba(255,255,255,0.5)`,
        }}
      />
      {/* Pulse dot */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${pulsePosition * 92}%`,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: colors.accentSolid,
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 16px ${colors.accentSolid}`,
        }}
      />
    </div>
  );
};

// suppress unused warnings — interpolate kept for parity with sibling scenes
void interpolate;
