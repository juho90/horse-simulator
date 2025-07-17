import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export class RaceStrategyPlan {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  reasoning: string;

  constructor(
    private horse: RaceHorse,
    private analysis: RaceSituationAnalysis
  ) {
    this.targetSpeed = 0;
    this.targetDirection = 0;
    this.targetAccel = 0;
    this.reasoning = "";
  }

  update(): void {
    this.targetSpeed = this.calculateTargetSpeed();
    this.targetDirection = this.calculateTargetDirection();
    this.targetAccel = this.calculateTargetAccel();
    this.reasoning = `Phase: ${this.analysis.racePhase}, State: ${this.analysis.recommendedState}`;
  }

  private calculateTargetSpeed(): number {
    const staminaRatio = this.horse.stamina / this.horse.maxStamina;
    let baseSpeed = this.horse.maxSpeed;
    if (this.analysis.racePhase === "final") {
      baseSpeed *= 0.95;
    } else if (staminaRatio < 0.3) {
      baseSpeed *= 0.6;
    } else if (this.analysis.recommendedState === "overtaking") {
      baseSpeed *= 0.9;
    } else {
      baseSpeed *= 0.8;
    }
    return Math.min(
      baseSpeed,
      this.horse.maxSpeed *
        (staminaRatio >= 0.5 ? 1.0 : Math.max(0.3, staminaRatio * 2))
    );
  }

  private calculateTargetDirection(): number {
    return this.horse.segment.getTangentDirectionAt(this.horse.x, this.horse.y);
  }

  private calculateTargetAccel(): number {
    const speedDiff = this.targetSpeed - this.horse.speed;
    return Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, speedDiff * 0.5)
    );
  }
}
