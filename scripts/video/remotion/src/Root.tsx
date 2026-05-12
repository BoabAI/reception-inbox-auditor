import React from "react";
import { Composition } from "remotion";
import { ExplainerVideo } from "./ExplainerVideo";
import { totalFrames } from "./lib/timing";
import { video } from "./lib/branding";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ExplainerVideo"
      component={ExplainerVideo}
      durationInFrames={totalFrames()}
      fps={video.fps}
      width={video.width}
      height={video.height}
    />
  );
};
