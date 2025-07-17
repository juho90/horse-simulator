export enum Lane {
  Inner = "inner",
  Middle = "middle",
  Outer = "outer",
}

export enum LaneChange {
  Inner = "inner",
  Outer = "outer",
  Stay = "stay",
}

export interface LaneEvaluation {
  lane: Lane;
  safety: number;
  efficiency: number;
  opportunity: number;
  totalScore: number;
  transitionCost: number;
}

export enum RacePhase {
  Early = "early",
  Middle = "middle",
  Late = "late",
  Final = "final",
}

export interface PhaseWeights {
  safety: number;
  efficiency: number;
  opportunity: number;
}
