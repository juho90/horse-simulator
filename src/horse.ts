import { HorseStats } from "./types";

export class Horse {
  public position: number = 0;
  public staminaLeft: number;

  constructor(public name: string, public stats: HorseStats) {
    this.staminaLeft = stats.stamina;
  }

  run(turn: number) {
    let effectiveSpeed = this.stats.speed;

    if (this.staminaLeft < this.stats.stamina * 0.5) {
      effectiveSpeed *= 0.9;
    }
    if (turn < 5) {
      effectiveSpeed += this.stats.burst * 0.3;
    }
    const temperamentEffect =
      (Math.random() - 0.5) * this.stats.temperament * 0.1;
    effectiveSpeed += temperamentEffect;
    effectiveSpeed -= this.stats.weight * 0.05;

    this.position += effectiveSpeed * (0.8 + Math.random() * 0.4);
    this.staminaLeft -= 1;
  }
}
