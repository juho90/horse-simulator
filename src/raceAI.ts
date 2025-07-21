import { DrivingMode } from "./drivingMode";
import { LaneChange } from "./laneEvaluation";
import { nextGenAvoidance } from "./nextGenAvoidance";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  laneChange: LaneChange;
  currentMode: DrivingMode;
}

export class RaceAI {
  private horse: RaceHorse;
  private raceEnv: RaceEnvironment;
  private raceAnalysis: RaceSituationAnalysis;
  private currentMode: DrivingMode = DrivingMode.MaintainingPace;
  private aiDecision: AIDecision | null = null;

  constructor(
    horse: RaceHorse,
    raceEnvironment: RaceEnvironment,
    raceAnalysis: RaceSituationAnalysis
  ) {
    this.horse = horse;
    this.raceEnv = raceEnvironment;
    this.raceAnalysis = raceAnalysis;
    this.currentMode = DrivingMode.MaintainingPace;
  }

  update(turn: number): AIDecision {
    const decision = this.makeDecision();
    this.aiDecision = decision;
    return decision;
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDecision(): AIDecision | null {
    return this.aiDecision;
  }

  private makeDecision(): AIDecision {
    const targetSpeed = this.horse.maxSpeed * 0.8;
    const targetDirection = nextGenAvoidance(
      this.horse,
      this.raceEnv,
      this.raceAnalysis
    );
    const targetAccel = Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, (targetSpeed - this.horse.speed) * 0.1)
    );
    return {
      targetSpeed,
      targetDirection,
      targetAccel,
      laneChange: LaneChange.Stay,
      currentMode: DrivingMode.MaintainingPace,
    };
  }
}
