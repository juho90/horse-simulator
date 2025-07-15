import type { RaceHorse } from "../raceHorse";

export type HorseStateType = "maintainingPace" | "overtaking" | "blocked";

export abstract class HorseState {
  public readonly name: HorseStateType;
  protected horse: RaceHorse;
  protected isActive: boolean;
  protected cooldown: number;

  constructor(name: HorseStateType, horse: RaceHorse) {
    this.name = name;
    this.horse = horse;
    this.isActive = false;
    this.cooldown = 0;
  }

  abstract enter(target?: RaceHorse): void;
  abstract execute(otherHorses: RaceHorse[]): void;
  abstract exit(): void;

  public isActiveState(): boolean {
    return this.isActive;
  }

  public cooldownTick(tick: number): void {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - tick);
    }
  }

  public isOnCooldown(): boolean {
    return this.cooldown > 0;
  }
}
