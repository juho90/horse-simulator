import { DrivingMode } from "./drivingMode";
import { LaneChange } from "./laneEvaluation";
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
  private aiDecision: AIDecision;

  constructor(
    horse: RaceHorse,
    raceEnvironment: RaceEnvironment,
    raceAnalysis: RaceSituationAnalysis
  ) {
    this.horse = horse;
    this.raceEnv = raceEnvironment;
    this.raceAnalysis = raceAnalysis;
    this.aiDecision = {
      targetSpeed: horse.maxSpeed,
      targetDirection: horse.raceHeading,
      targetAccel: horse.maxAccel,
      laneChange: LaneChange.Stay,
      currentMode: DrivingMode.MaintainingPace,
    };
  }

  update(turn: number): AIDecision {
    this.aiDecision = this.makeDecision();
    this.currentMode = this.aiDecision.currentMode;
    return this.aiDecision;
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDecision(): AIDecision {
    return this.aiDecision;
  }

  private makeDecision(): AIDecision {
    this.aiDecision = {
      targetSpeed: this.horse.maxSpeed,
      targetDirection: this.horse.raceHeading,
      targetAccel: this.horse.maxAccel,
      laneChange: LaneChange.Stay,
      currentMode: this.currentMode,
    };
    return this.aiDecision;
  }
}
