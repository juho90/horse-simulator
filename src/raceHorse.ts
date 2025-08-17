import { RaceHorseStatus } from "./raceHorseStatus";
import { EPSILON } from "./raceMath";
import { RaceSegmentNode } from "./raceSegment";
import { RaceTracker } from "./raceTracker";

export class RaceHorse {
  private status: RaceHorseStatus;
  private speed: number;
  private accel: number;
  private stamina: number;
  x: number;
  y: number;
  raceLane: number;
  raceDistance: number;
  lap: number = 0;
  progress: number = 0;
  finished: boolean = false;

  path: RaceSegmentNode[] = [];

  constructor(horse: RaceHorseStatus, gateNode: RaceSegmentNode) {
    if (EPSILON < gateNode.progress) {
      throw new Error("Gate node progress should be zero");
    }
    this.status = horse;
    this.speed = horse.calculateStartSpeed();
    this.accel = 0;
    this.stamina = horse.calculateMaxStamina();
    this.x = gateNode.x;
    this.y = gateNode.y;
    this.raceLane = gateNode.lane;
    this.raceDistance = 0;
  }

  getHorseId(): number {
    return this.status.horseId;
  }

  getHorseName(): string {
    return this.status.name;
  }

  getHorseSpeed(): number {
    return this.speed;
  }

  getHorseAccel(): number {
    return this.accel;
  }

  getHorseStamina(): number {
    return this.stamina;
  }

  moveOnTrack(
    turn: number,
    raceTrackNode: RaceTracker,
    others: RaceHorse[]
  ): void {
    const maxSpeed = this.status.calculateMaxSpeed();
    const maxAccel = this.status.calculateMaxAcceleration();
    const addAccel = this.status.calculateAccelerationPerTurn();
    const accel = Math.min(this.accel + addAccel, maxAccel);
    const speed = Math.min(this.speed + accel, maxSpeed);
    let remainingDistance = speed;
    do {
      let nextPos = raceTrackNode.findNextPosInPath(
        { x: this.x, y: this.y },
        this.progress,
        remainingDistance,
        this.path
      );
      if (nextPos) {
        this.x = nextPos.pos.x;
        this.y = nextPos.pos.y;
        this.raceLane = nextPos.startNode.lane;
        this.progress = nextPos.progress;
        remainingDistance -= nextPos.moveDistance;
      } else {
        const path = raceTrackNode.findPath(this, others);
        if (!path || !path.length) {
          throw new Error("No valid path found");
        }
        this.path = path;
      }
      if (1 <= this.progress) {
        this.lap++;
        this.progress %= 1;
      }
    } while (EPSILON < remainingDistance);
    this.accel = accel;
    this.speed = speed;
    this.raceDistance += this.speed;
  }
}
