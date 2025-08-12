import { Horse } from "./horse";
import { EPSILON } from "./raceMath";
import { RaceSegmentNode } from "./raceSegment";
import { RaceTrackNode } from "./raceTrackNode";

export class RaceHorse {
  horseId: number;
  name: string;
  maxSpeed: number;
  maxAccel: number;
  maxStamina: number;
  staminaConsumption: number;
  staminaRecovery: number;
  reaction: number;
  speed: number;
  accel: number;
  stamina: number;
  x: number;
  y: number;
  raceLane: number;
  raceDistance: number;
  lap: number = 0;
  progress: number = 0;
  finished: boolean = false;

  path: RaceSegmentNode[] = [];

  constructor(horse: Horse, gateNode: RaceSegmentNode) {
    if (EPSILON < gateNode.progress) {
      throw new Error("Gate node progress should be zero");
    }
    this.horseId = horse.horseId;
    this.name = horse.name;
    this.maxSpeed = horse.calculateMaxSpeed();
    this.maxAccel = horse.calculateMaxAcceleration();
    this.maxStamina = horse.calculateMaxStamina();
    this.staminaConsumption = horse.calculateStaminaConsumption();
    this.staminaRecovery = horse.calculateStaminaRecovery();
    this.reaction = horse.calculateReaction();
    this.speed = 0;
    this.accel = this.maxAccel;
    this.stamina = this.maxStamina;
    this.x = gateNode.x;
    this.y = gateNode.y;
    this.raceLane = gateNode.lane;
    this.raceDistance = 0;
  }

  moveOnTrack(
    turn: number,
    raceTrackNode: RaceTrackNode,
    others: RaceHorse[]
  ): void {
    const accel = Math.min(this.accel + 0.2, this.maxAccel);
    const speed = Math.min(this.speed + accel, this.maxSpeed);
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
