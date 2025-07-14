import type { RaceHorse } from "../raceHorse";
import { lerpAngle } from "../raceMath";
import { HorseState, HorseStateType } from "./horseState";

export class MaintainingPaceState implements HorseState {
  readonly name: HorseStateType = "maintainingPace";
  isActive: boolean = false;
  cooldown: number = 0;

  enter(horse: RaceHorse): void {
    // This state is active by default
    this.isActive = true;
  }

  exit(horse: RaceHorse): void {
    this.isActive = false;
  }

  execute(horse: RaceHorse, otherHorses: RaceHorse[]): void {
    // Check for overtaking opportunity
    const horseInFront = horse.findClosestHorseInFront(otherHorses);
    if (
      horse.canActivateState("overtaking") &&
      horseInFront &&
      horse.shouldAttemptOvertake(horseInFront)
    ) {
      horse.activateState("overtaking", { target: horseInFront });
      // Note: We don't return, as MaintainingPace continues to run alongside Overtaking
    }

    const { moveDir, riskWeight } = horse.findDirOnTrack(otherHorses);
    horse.riskLevel = riskWeight;

    let cornerAnticipationFactor = 0;
    const LOOK_AHEAD_DISTANCE = 150;
    if (
      horse.farthestRaycast &&
      horse.farthestRaycast.hitDistance < LOOK_AHEAD_DISTANCE
    ) {
      cornerAnticipationFactor = Math.pow(
        1 - horse.farthestRaycast.hitDistance / LOOK_AHEAD_DISTANCE,
        2
      );
    }

    const speedReduction = Math.max(
      riskWeight * 0.5,
      cornerAnticipationFactor * 0.7
    );

    const staminaEffect = Math.max(
      0.3,
      horse.currentStamina / horse.maxStamina
    );
    const currentMaxSpeed = horse.maxSpeed * staminaEffect;
    const targetSpeed = currentMaxSpeed * (1 - speedReduction);

    if (horse.speed > targetSpeed) {
      horse.acceleration = -horse.maxAcceleration;
    } else {
      horse.acceleration = horse.maxAcceleration;
    }
    horse.heading = lerpAngle(horse.heading, moveDir, 0.4);
  }
}
