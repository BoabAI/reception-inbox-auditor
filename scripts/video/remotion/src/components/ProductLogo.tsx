import React from "react";

/**
 * Lightweight inline logos for the scene-2 flow diagram. Simple SVG monograms
 * — not the actual brand artwork, but visually clean and self-contained.
 */

export const OutlookLogo: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <rect x="6" y="22" width="56" height="56" rx="6" fill="#0078D4" />
    <text
      x="34"
      y="62"
      textAnchor="middle"
      fontFamily="Segoe UI, Inter, sans-serif"
      fontWeight={800}
      fontSize="32"
      fill="#fff"
    >
      O
    </text>
    <rect x="62" y="32" width="34" height="36" rx="3" fill="#fff" stroke="#0078D4" strokeWidth={2}/>
    <path d="M 62 32 L 79 50 L 96 32" stroke="#0078D4" strokeWidth={2.5} fill="none" />
  </svg>
);

export const AzureAILogo: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="azGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0078D4" />
        <stop offset="100%" stopColor="#50E6FF" />
      </linearGradient>
    </defs>
    <path
      d="M 28 22 L 64 22 L 88 78 L 60 78 L 50 56 L 36 78 L 12 78 Z"
      fill="url(#azGrad)"
    />
    <text
      x="50"
      y="48"
      textAnchor="middle"
      fontFamily="Segoe UI, Inter, sans-serif"
      fontWeight={800}
      fontSize="14"
      fill="#fff"
      letterSpacing={1.5}
    >
      AI
    </text>
  </svg>
);

export const SharePointLogo: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <circle cx="36" cy="42" r="22" fill="#038387" />
    <circle cx="62" cy="42" r="18" fill="#03787C" opacity={0.85} />
    <circle cx="50" cy="64" r="14" fill="#036C70" opacity={0.85} />
    <text
      x="36"
      y="49"
      textAnchor="middle"
      fontFamily="Segoe UI, Inter, sans-serif"
      fontWeight={800}
      fontSize="20"
      fill="#fff"
    >
      S
    </text>
  </svg>
);

export const AustraliaPill: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: -14,
      left: "50%",
      transform: "translateX(-50%)",
      background: "linear-gradient(135deg, #00843D 0%, #009859 100%)",
      color: "#fff",
      padding: "4px 12px",
      fontSize: 14,
      fontWeight: 700,
      borderRadius: 999,
      whiteSpace: "nowrap",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      letterSpacing: 0.5,
    }}
  >
    AU REGION
  </div>
);
