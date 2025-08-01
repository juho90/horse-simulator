import { Horse } from "./horse";
import { RaceSegment, RaceSegmentNode } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

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
  gate: number;
  x: number;
  y: number;
  raceHeading: number;
  raceDistance: number;
  lap: number = 0;
  progress: number = 0;
  finished: boolean = false;

  private path: RaceSegmentNode[] = [];
  private currentNodeIndex: number | null = null;
  private nextNodeIndex: number | null = null;

  constructor(horse: Horse, gate: number, firstSegment: RaceSegment) {
    const gateOffset = (gate + 1) * 17;
    const ortho = firstSegment.getOrthoVectorAt(
      firstSegment.start.x,
      firstSegment.start.y
    );
    const x = firstSegment.start.x + ortho.x * gateOffset;
    const y = firstSegment.start.y + ortho.y * gateOffset;
    const raceHeading = firstSegment.getTangentDirectionAt(
      firstSegment.start.x,
      firstSegment.start.y
    );
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
    this.gate = gate;
    this.x = x;
    this.y = y;
    this.raceHeading = raceHeading;
    this.raceDistance = 0;
  }

  getCurrentNode(): RaceSegmentNode | null {
    if (!this.currentNodeIndex) {
      return null;
    }
    return this.path[this.currentNodeIndex];
  }

  checkRefreshPath(track: RaceTrack, others: RaceHorse[]): boolean {
    return false;
  }

  refreshPath(raceSegmentNodes: RaceSegmentNode[]): void {
    this.path = raceSegmentNodes;
    if (raceSegmentNodes.length === 0) {
      this.nextNodeIndex = null;
      return;
    }
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < raceSegmentNodes.length; i++) {
      const node = raceSegmentNodes[i];
      let valid = false;
      if (node.progress > this.progress) {
        valid = true;
      } else if (this.progress - node.progress > 0.5) {
        valid = true;
      }
      if (!valid) continue;
      const diff = Math.abs(this.progress - node.progress);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    if (minDiff === Infinity) {
      bestIdx = 0;
      minDiff = Math.abs(this.progress - raceSegmentNodes[0].progress);
      for (let i = 1; i < raceSegmentNodes.length; i++) {
        const node = raceSegmentNodes[i];
        const diff = Math.abs(this.progress - node.progress);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
    }
    this.nextNodeIndex = bestIdx;
  }

  moveOnTrack(turn: number, track: RaceTrack, others: RaceHorse[]): void {
    if (
      this.nextNodeIndex !== null &&
      this.nextNodeIndex >= 0 &&
      this.nextNodeIndex < this.path.length
    ) {
      const nextNode = this.path[this.nextNodeIndex];
      this.raceHeading = Math.atan2(nextNode.y - this.y, nextNode.x - this.x);
      // 다음 노드에 충분히 가까워지면 인덱스 증가
      const distToNext = Math.hypot(this.x - nextNode.x, this.y - nextNode.y);
      if (distToNext < 5 && this.nextNodeIndex < this.path.length - 1) {
        this.nextNodeIndex++;
      }
    }
    this.accel = Math.min(this.maxAccel, this.maxAccel);
    this.speed = Math.min(this.speed + this.accel, this.maxSpeed);
    this.x += Math.cos(this.raceHeading) * this.speed;
    this.y += Math.sin(this.raceHeading) * this.speed;
    this.raceDistance += this.speed;
    if (
      track.raceLength <=
      this.progress * track.trackLength + this.lap * track.trackLength
    ) {
      this.finished = true;
    }
  }
}
