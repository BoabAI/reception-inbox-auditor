import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { Scene1Pile } from "./scenes/Scene1Pile";
import { Scene2AutoLog } from "./scenes/Scene2AutoLog";
import { Scene3Inbox } from "./scenes/Scene3Inbox";
import { Scene4Stats } from "./scenes/Scene4Stats";
import { Scene5Compliance } from "./scenes/Scene5Compliance";
import { Scene6Close } from "./scenes/Scene6Close";
import { Watermark } from "./components/Watermark";
import timing from "../../narration-timing.json";

loadInter();
loadGrotesk();

const FPS = 30;

const segDur = (sceneId: string): number => {
  const seg = timing.segments.find((s) => s.sceneId === sceneId);
  if (!seg) throw new Error(`No timing for ${sceneId}`);
  return Math.ceil((seg.duration + timing.paddingSeconds) * FPS);
};

const sceneOrder = ["pile", "auto-log", "inbox", "stats", "compliance", "close"] as const;
const sceneById: Record<string, React.FC> = {
  pile: Scene1Pile,
  "auto-log": Scene2AutoLog,
  inbox: Scene3Inbox,
  stats: Scene4Stats,
  compliance: Scene5Compliance,
  close: Scene6Close,
};

export const ExplainerVideo: React.FC = () => {
  // useVideoConfig() to avoid unused import warning
  void useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("narration.mp3")} />
      <Series>
        {sceneOrder.map((id) => {
          const Cmp = sceneById[id];
          return (
            <Series.Sequence key={id} durationInFrames={segDur(id)}>
              <Cmp />
            </Series.Sequence>
          );
        })}
      </Series>
      {/* Persistent SMEC AI watermark on all scenes except the close (which has the logo full-size) */}
      <Series>
        <Series.Sequence durationInFrames={segDur("pile") + segDur("auto-log") + segDur("inbox") + segDur("stats") + segDur("compliance")}>
          <Watermark />
        </Series.Sequence>
        <Series.Sequence durationInFrames={segDur("close")}>
          {/* no watermark on close — logo is the hero */}
          <></>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
