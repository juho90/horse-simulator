import { RaceHorse } from "../raceHorse";
import { Distance } from "../raceMath";
import { HorseState } from "./horseState";

export class OvertakingState extends HorseState {
  private readonly MAX_OVERTAKE_TURNS = 10;
  private readonly OVERTAKE_COOLDOWN = 80;
  private target: RaceHorse | null = null;
  private overtakeTurns: number = 0;
  private overtakeSpeedBoost: number = 0;
  private overtakeAccelBoost: number = 0;

  constructor(horse: RaceHorse) {
    super("overtaking", horse);
    this.cooldown = 0;
    this.overtakeTurns = 0;
  }

  enter(target?: RaceHorse): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
    this.target = target!;
    this.overtakeTurns = 0;
    this.overtakeSpeedBoost = this.horse.maxSpeed * 0.1;
    this.overtakeAccelBoost = this.horse.maxAccel * 0.2;
    this.horse.maxSpeed += this.overtakeSpeedBoost;
    this.horse.maxAccel += this.overtakeAccelBoost;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (this.isActiveState() === false) {
      return;
    }
    if (!this.target) {
      this.horse.deactivateState(this.name);
      return;
    }
    this.overtakeTurns++;
    const distanceToTarget = Distance(this.target, this.horse);
    if (
      this.horse.raceDistance > this.target.raceDistance ||
      distanceToTarget > 60 ||
      this.overtakeTurns > this.MAX_OVERTAKE_TURNS ||
      this.horse.stamina < 20
    ) {
      this.horse.deactivateState(this.name);
      return;
    }
    this.horse.stamina -= 0.5;
  }

  exit(): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.target = null;
    this.isActive = false;
    this.cooldown = this.OVERTAKE_COOLDOWN;
    const newMaxSpeed = Math.max(
      0,
      this.horse.maxSpeed - this.overtakeSpeedBoost
    );
    this.horse.maxSpeed = newMaxSpeed;
    const newMaxAccel = Math.max(
      0,
      this.horse.maxAccel - this.overtakeAccelBoost
    );
    this.horse.maxAccel = newMaxAccel;
    this.overtakeSpeedBoost = 0;
    this.overtakeAccelBoost = 0;
  }
}
