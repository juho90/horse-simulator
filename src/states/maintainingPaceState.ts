import type { RaceHorse } from "../raceHorse";
import { LerpAngle } from "../raceMath";
import { RaceStrategyPlan } from "../raceStrategyPlan";
import { HorseState } from "./horseState";

export class MaintainingPaceState extends HorseState {
  constructor(horse: RaceHorse) {
    super("maintainingPace", horse);
  }

  enter(): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (!this.isActiveState()) {
      return;
    }
    const envData = this.horse.updateEnvironment(otherHorses);
    const analysis = this.horse.updateAnalyzeSituation();
    const strategy = this.horse.updatePlanStrategy();
    this.applyStatePattern(strategy);
    this.checkStateTransition(analysis);
  }

  private applyStatePattern(strategy: RaceStrategyPlan): void {
    this.horse.accel = strategy.targetAccel * 0.8;
    this.horse.raceHeading = LerpAngle(
      this.horse.raceHeading,
      strategy.targetDirection,
      0.3
    );
  }

  private checkStateTransition(analysis: any): void {
    if (analysis.recommendedState !== "maintainingPace") {
      this.horse.activateState(analysis.recommendedState);
    }
  }

  exit(): void {
    if (!this.isActiveState()) {
      return;
    }
    this.isActive = false;
  }
}
