export type HorseStats = {
  speed: number;
  stamina: number;
  burst: number;
  temperament: number;
  weight: number;
};

export type Corner = { start: number; end: number };

export type TrackOptions = {
  name: string;
  finishLine: number;
  corners?: Corner[];
};
