import { RaceHorse } from "../raceHorse";
import { LerpAngle } from "../raceMath";
import { RaceStrategyPlan } from "../raceStrategyPlan";
import { HorseState } from "./horseState";

export class OvertakingState extends HorseState {
  private readonly MAX_OVERTAKE_TURNS = 10;
  private readonly OVERTAKE_COOLDOWN = 80;
  private target: RaceHorse | null = null;
  private overtakeTurns: number = 0;
  private overtakeSpeedBoost: number = 0;
  private overtakeAccelBoost: number = 0;

  constructor(horse: RaceHorse) {
    super("overtaking", horse);
    this.cooldown = 0;
    this.overtakeTurns = 0;
  }

  enter(target?: RaceHorse): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
    this.target = target!;
    this.overtakeTurns = 0;
    this.overtakeSpeedBoost = this.horse.maxSpeed * 0.1;
    this.overtakeAccelBoost = this.horse.maxAccel * 0.2;
    this.horse.maxSpeed += this.overtakeSpeedBoost;
    this.horse.maxAccel += this.overtakeAccelBoost;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (!this.isActiveState()) {
      return;
    }
    const envData = this.horse.updateEnvironment(otherHorses);
    const analysis = this.horse.updateAnalyzeSituation();
    const strategy = this.horse.updatePlanStrategy();
    this.applyStatePattern(strategy);
    this.updateOvertakeProgress();
    this.checkStateTransition(analysis);
  }

  private applyStatePattern(strategy: RaceStrategyPlan): void {
    this.horse.accel = strategy.targetAccel * 1.2;
    this.horse.raceHeading = LerpAngle(
      this.horse.raceHeading,
      strategy.targetDirection,
      0.5
    );
  }

  private updateOvertakeProgress(): void {
    this.overtakeTurns++;
    if (this.overtakeTurns >= this.MAX_OVERTAKE_TURNS) {
      this.horse.activateState("maintainingPace");
    }
  }

  private checkStateTransition(analysis: any): void {
    if (analysis.recommendedState !== "overtaking") {
      this.horse.activateState(analysis.recommendedState);
    }
  }

  exit(): void {
    if (!this.isActiveState()) {
      return;
    }
    this.isActive = false;
    this.horse.maxSpeed -= this.overtakeSpeedBoost;
    this.horse.maxAccel -= this.overtakeAccelBoost;
    this.cooldown = this.OVERTAKE_COOLDOWN;
    this.target = null;
    this.overtakeTurns = 0;
  }
}
