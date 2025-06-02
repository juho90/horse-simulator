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

export interface HorseStats {
  speed: number;
  stamina: number;
  burst: number;
  weight: number;
  temperament: number;
  cornering: number;
  positioning: number;
  paceSense: number;
  maxSpeed: number; // 최대 속도 (m/s)
  acceleration: number; // 가속 (m/s^2)
}
