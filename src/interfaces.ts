export interface TrackOptions {
  name: string;
  finishLine: number;
  corners: TrackCorner[];
  statWeights: Record<string, number>; // 트랙별 스탯 가치(선택)
}

export interface TrackCorner {
  start: number;
  end: number;
  difficulty: number;
}

export interface HorseOptions {
  profile: HorseProfile;
  stats: HorseStats;
}

export type RunningStyle = "선행" | "선입" | "차분" | "추입";

export interface HorseProfile {
  name: string;
  weight: number; // 체중
  temperament: number; // 성격(기질)
  runningStyle: RunningStyle; // 각질
}

export interface HorseStats {
  speed: number;
  stamina: number;
  power: number;
  paceSense: number;
  cornering: number;
  positioning: number;
}

export interface RaceStats {
  name: string;
  lane: number;
  distance: number;
  speed: number;
  accel: number;
}

export interface RaceLog {
  turn: number;
  states: RaceStats[];
}
