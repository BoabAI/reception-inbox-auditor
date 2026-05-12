import timing from "../../../narration-timing.json";

export type Segment = {
  sceneId: string;
  screenshotId?: string;
  file: string;
  duration: number;
  offset: number;
};

export const segments = timing.segments as Segment[];
export const paddingSeconds: number = timing.paddingSeconds;
export const totalDuration: number = timing.totalDuration;

export const FPS = 30;

export function durationFrames(sceneId: string): number {
  const seg = segments.find((s) => s.sceneId === sceneId);
  if (!seg) throw new Error(`No timing segment for ${sceneId}`);
  return Math.ceil((seg.duration + paddingSeconds) * FPS);
}

export function totalFrames(): number {
  return Math.ceil(totalDuration * FPS);
}
