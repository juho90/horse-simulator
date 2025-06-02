export enum RacePhase {
  Early = "early",
  Middle = "middle",
  Final = "final",
}

export type Corner = { start: number; end: number };

export type TrackOptions = {
  name: string;
  finishLine: number;
  corners?: Corner[];
};
