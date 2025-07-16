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
    let targetSpeed;
    if (speedReduction < 0.1) {
      targetSpeed = currentMaxSpeed;
    } else {
      targetSpeed = currentMaxSpeed * (1 - speedReduction);
    }
    const speedDifference = targetSpeed - this.horse.speed;
    const SPEED_TOLERANCE = 0.5;
    const speedRatio = this.horse.speed / currentMaxSpeed;
    const riskAccelReduction = Math.max(riskWeight, cornerAnticipationFactor);
    const safetyAccelMultiplier = Math.max(0.1, 1 - riskAccelReduction * 0.7);
    if (speedDifference > SPEED_TOLERANCE) {
      const accelReduction = Math.pow(speedRatio, 2);
      const speedAccelMultiplier = Math.max(0.1, 1 - accelReduction * 0.8);
      const finalAccelMultiplier = speedAccelMultiplier * safetyAccelMultiplier;
      this.horse.accel = this.horse.maxAccel * finalAccelMultiplier;
    } else if (speedDifference < -SPEED_TOLERANCE) {
      const speedExcess = Math.abs(speedDifference);
      const brakeIntensity = Math.min(
        1.0,
        speedExcess / (currentMaxSpeed * 0.3)
      );
      this.horse.accel = -this.horse.maxAccel * brakeIntensity;
    } else {
      if (staminaEffect > 0.7 && this.horse.speed < currentMaxSpeed * 0.9) {
        this.horse.accel = this.horse.maxAccel * 0.4;
      } else if (
        staminaEffect > 0.5 &&
        this.horse.speed < currentMaxSpeed * 0.95
      ) {
        this.horse.accel = this.horse.maxAccel * 0.2;
      } else if (riskAccelReduction > 0.3) {
        this.horse.accel = -this.horse.maxAccel * 0.2 * riskAccelReduction;
      } else {
        this.horse.accel = this.horse.maxAccel * 0.1;
      }
    }
    this.horse.raceHeading = LerpAngle(this.horse.raceHeading, moveDir, 0.4);
  }

  exit(): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.isActive = false;
  }
}
