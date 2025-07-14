import type { RaceHorse } from "../raceHorse";
import { HorseState, HorseStateType } from "./horseState";

export class BlockedState implements HorseState {
  readonly name: HorseStateType = "blocked";
  isActive: boolean = false;
  cooldown: number = 0;

  enter(horse: RaceHorse): void {
    this.isActive = true;
  }

  exit(horse: RaceHorse): void {
    this.isActive = false;
  }

  execute(horse: RaceHorse, otherHorses: RaceHorse[]): void {
    // Logic for when the horse is blocked
    // e.g., slow down, look for a gap

    // For now, just deactivate self and activate maintaining pace
    horse.deactivateState(this.name);
    if (horse.canActivateState("maintainingPace")) {
      horse.activateState("maintainingPace");
    }
  }
}
