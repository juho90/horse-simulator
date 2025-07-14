import type { RaceHorse } from "../raceHorse";

export type HorseStateType = "maintainingPace" | "overtaking" | "blocked";

export interface HorseState {
  readonly name: HorseStateType;
  isActive: boolean;
  cooldown: number;

  enter(horse: RaceHorse, data?: any): void;
  execute(horse: RaceHorse, otherHorses: RaceHorse[]): void;
  exit(horse: RaceHorse): void;
}
