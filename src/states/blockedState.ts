import type { RaceHorse } from "../raceHorse";
import { HorseState } from "./horseState";

export class BlockedState extends HorseState {
  constructor(horse: RaceHorse) {
    super("blocked", horse);
  }

  enter(): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.horse.deactivateState(this.name);
    if (this.horse.canActivateState("maintainingPace")) {
      this.horse.activateState("maintainingPace");
    }
  }

  exit(): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.isActive = false;
  }
}
