import type { RaceHorse } from "../raceHorse";
import { LerpAngle } from "../raceMath";
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
    if (this.isActiveState() === false) {
      return;
    }
    const horseInFront = this.horse.findClosestHorseInFront(otherHorses);
    if (
      this.horse.canActivateState("overtaking") &&
      horseInFront &&
      this.horse.shouldAttemptOvertake(horseInFront)
    ) {
      this.horse.activateState("overtaking", { target: horseInFront });
    }
    const { moveDir, riskWeight } = this.horse.findDirOnTrack(otherHorses);
    this.horse.riskLevel = riskWeight;

    let cornerAnticipationFactor = 0;
    const LOOK_AHEAD_DISTANCE = 150;
    if (
      this.horse.farthestRaycast &&
      this.horse.farthestRaycast.hitDistance < LOOK_AHEAD_DISTANCE
    ) {
      cornerAnticipationFactor = Math.pow(
        1 - this.horse.farthestRaycast.hitDistance / LOOK_AHEAD_DISTANCE,
        2
      );
    }
    const speedReduction = Math.max(
      riskWeight * 0.5,
      cornerAnticipationFactor * 0.7
    );
    const staminaEffect = Math.max(
      0.3,
      this.horse.stamina / this.horse.maxStamina
    );
    const currentMaxSpeed = this.horse.maxSpeed * staminaEffect;
    const targetSpeed = currentMaxSpeed * (1 - speedReduction);

    if (this.horse.speed > targetSpeed) {
      this.horse.acceleration = -this.horse.maxAcceleration;
    } else {
      this.horse.acceleration = this.horse.maxAcceleration;
    }
    this.horse.heading = LerpAngle(this.horse.heading, moveDir, 0.4);
  }

  exit(): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.isActive = false;
  }
}
