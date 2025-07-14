import { RaceHorse } from "../raceHorse";
import { lerpAngle } from "../raceMath";
import { HorseState, HorseStateType } from "./horseState";

export class OvertakingState implements HorseState {
  readonly name: HorseStateType = "overtaking";
  isActive: boolean = false;
  cooldown: number = 0;
  private target!: RaceHorse;
  private overtakeTurns: number = 0;
  private readonly MAX_OVERTAKE_TURNS = 150; // Increased duration
  private readonly OVERTAKE_COOLDOWN = 200; // Cooldown after attempting

  enter(horse: RaceHorse, data: { target: RaceHorse }): void {
    this.isActive = true;
    this.target = data.target;
    this.overtakeTurns = 0;
    horse.temporarilyBoostSpeed(); // Boost speed upon entering state
  }

  execute(horse: RaceHorse, otherHorses: RaceHorse[]): void {
    this.overtakeTurns++;

    const distanceToTarget = horse.getDistanceTo(this.target);
    // Exit conditions
    if (
      horse.distance > this.target.distance || // Successfully overtaken
      distanceToTarget > 60 || // Target is too far
      this.overtakeTurns > this.MAX_OVERTAKE_TURNS || // Timed out
      horse.currentStamina < 20 // Too tired
    ) {
      horse.deactivateState(this.name);
      return;
    }

    // Continue boost
    horse.temporarilyBoostSpeed();

    // Direction logic
    const { moveDir } = horse.findDirOnTrack(otherHorses);
    const angleToTarget = Math.atan2(
      this.target.y - horse.y,
      this.target.x - horse.x
    );
    const finalDir = lerpAngle(moveDir, angleToTarget, 0.2); // Stronger pull towards target
    horse.heading = lerpAngle(horse.heading, finalDir, 0.5);
  }

  exit(horse: RaceHorse): void {
    this.isActive = false;
    // Set a cooldown for the overtaking state when we exit
    this.cooldown = this.OVERTAKE_COOLDOWN;
  }
}
