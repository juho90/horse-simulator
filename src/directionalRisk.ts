export interface DirectionalRisk {
  front: number;
  left: number;
  right: number;
  frontLeft: number;
  frontRight: number;
  overall: number;
}

export interface RiskAnalysisDetail {
  wallRisk: DirectionalRisk;
  horseRisk: DirectionalRisk;
  speedRisk: DirectionalRisk;
  cornerRisk: DirectionalRisk;
  combined: DirectionalRisk;
}

export interface PerformanceMetrics {
  totalTurns: number;
  collisionEvents: number;
  nearMissEvents: number;
  raceCompletions: number;
  totalDistance: number;
  idealDistance: number;
  laneChangeCollisions: number;
  laneChanges: number;
  currentTurn: number;
  raceId: string;
}
