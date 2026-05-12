import React from "react";
import { colors, font } from "../lib/branding";

/**
 * macOS-style browser chrome frame. Wraps a screenshot so it reads as a real
 * web app shot rather than a floating image.
 */
export const BrowserFrame: React.FC<{
  url: string;
  children: React.ReactNode;
  width?: number;
  style?: React.CSSProperties;
}> = ({ url, children, width = 1680, style }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 16,
        background: "#1a1a2e",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.35)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 52,
          background: "#262640",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 14,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Dot color="#FF5F57" />
          <Dot color="#FEBC2E" />
          <Dot color="#28C840" />
        </div>
        <div
          style={{
            flex: 1,
            height: 30,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.body,
            fontSize: 14,
            color: colors.textSecondary,
            letterSpacing: 0.2,
          }}
        >
          {url}
        </div>
      </div>
      {/* Content area: WHITE so dark screenshots don't blend */}
      <div style={{ background: "#FFFFFF" }}>{children}</div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 13,
      height: 13,
      borderRadius: "50%",
      background: color,
    }}
  />
);
