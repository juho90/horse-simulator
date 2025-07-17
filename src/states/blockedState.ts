import { RaceHorse } from "../raceHorse";
import { LerpAngle } from "../raceMath";
import { RaceStrategyPlan } from "../raceStrategyPlan";
import { HorseState } from "./horseState";

export class BlockedState extends HorseState {
  private readonly BLOCK_CHECK_FRAMES = 5;
  private blockedFrames: number = 0;

  constructor(horse: RaceHorse) {
    super("blocked", horse);
    this.blockedFrames = 0;
  }

  enter(): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
    this.blockedFrames = 0;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (!this.isActiveState()) {
      return;
    }
    const envData = this.horse.updateEnvironment(otherHorses);
    const analysis = this.horse.updateAnalyzeSituation();
    const strategy = this.horse.updatePlanStrategy();
    this.applyStatePattern(strategy);
    this.updateBlockedProgress();
    this.checkStateTransition(analysis);
  }

  private applyStatePattern(strategy: RaceStrategyPlan): void {
    this.horse.accel = strategy.targetAccel * 0.3;
    this.horse.raceHeading = LerpAngle(
      this.horse.raceHeading,
      strategy.targetDirection,
      0.2
    );
  }

  private updateBlockedProgress(): void {
    this.blockedFrames++;

    if (this.blockedFrames >= this.BLOCK_CHECK_FRAMES) {
      this.horse.activateState("maintainingPace");
    }
  }

  private checkStateTransition(analysis: any): void {
    if (analysis.recommendedState !== "blocked") {
      this.horse.activateState(analysis.recommendedState);
    }
  }

  exit(): void {
    if (!this.isActiveState()) {
      return;
    }
    this.isActive = false;
    this.blockedFrames = 0;
  }
}
