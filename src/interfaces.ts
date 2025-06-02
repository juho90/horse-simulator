export interface TrackOptions {
  name: string;
  finishLine: number;
  corners: TrackCorner[];
}

export interface TrackCorner {
  start: number;
  end: number;
  difficulty: number;
}

export interface HorseStats {
  speed: number;
  stamina: number;
  burst: number;
  weight: number;
  temperament: number;
  cornering: number;
  positioning: number;
  paceSense: number;
}
