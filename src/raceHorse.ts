import { Horse } from "./horse";
import { EPSILON, NormalizeTheta } from "./raceMath";
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
  path: RaceSegmentNode[] = [];
  lap: number = 0;
  progress: number = 0;
  finished: boolean = false;

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
    if (
      this.currentNodeIndex === null ||
      this.currentNodeIndex < 0 ||
      this.path.length <= this.currentNodeIndex
    ) {
      return null;
    }
    return this.path[this.currentNodeIndex];
  }

  getNextNode(): RaceSegmentNode | null {
    if (
      this.nextNodeIndex === null ||
      this.nextNodeIndex < 0 ||
      this.path.length <= this.nextNodeIndex
    ) {
      return null;
    }
    return this.path[this.nextNodeIndex];
  }

  checkRefreshPath(track: RaceTrack, others: RaceHorse[]): boolean {
    const currentNode = this.getCurrentNode();
    if (!currentNode) {
      return true;
    }
    const nextNode = this.getNextNode();
    if (!nextNode) {
      return true;
    }
    const accel = Math.min(this.accel + 0.2, this.maxAccel);
    const speed = Math.min(this.speed + accel, this.maxSpeed);
    const segment = track.getSegment(currentNode.segmentIndex);
    const x = this.x + Math.cos(this.raceHeading) * speed;
    const y = this.y + Math.sin(this.raceHeading) * speed;
    if (!segment.isInner(x, y)) {
      return true;
    }
    return false;
  }

  refreshPath(track: RaceTrack, path: RaceSegmentNode[]): void {
    if (path.length === 0) {
      return;
    }
    let currentNodeIndex = 0;
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      const trackProgress = track.getTrackProgress(
        node.segmentIndex,
        this.x,
        this.y
      );
      const diffProgress = node.progress - trackProgress;
      if (diffProgress < EPSILON) {
        continue;
      }
      currentNodeIndex = i;
      break;
    }
    this.path = path;
    this.currentNodeIndex = currentNodeIndex;
    this.nextNodeIndex = currentNodeIndex + 1;
  }

  moveOnTrack(turn: number, track: RaceTrack, others: RaceHorse[]): void {
    const currentNode = this.getCurrentNode();
    if (!currentNode) {
      return;
    }
    const nextNode = this.getNextNode();
    if (!nextNode) {
      return;
    }
    const raceHeading = NormalizeTheta(this, currentNode);
    const accel = Math.min(this.accel + 0.2, this.maxAccel);
    const speed = Math.min(this.speed + accel, this.maxSpeed);
    const segment = track.getSegment(currentNode.segmentIndex);
    const x = this.x + Math.cos(raceHeading) * speed;
    const y = this.y + Math.sin(raceHeading) * speed;
    const progress = track.getTrackProgress(segment.segmentIndex, x, y);
    let segmentIndex = segment.segmentIndex;
    if (currentNode.progress < progress) {
      this.currentNodeIndex = this.nextNodeIndex ?? 0;
      this.nextNodeIndex = this.currentNodeIndex + 1;
      segmentIndex = nextNode.segmentIndex;
    }
    this.accel = accel;
    this.speed = speed;
    this.x = x;
    this.y = y;
    this.raceHeading = raceHeading;
    this.raceDistance += this.speed;
    this.progress = track.getRaceProgress(this.lap, segmentIndex, x, y);
    if (progress >= 1) {
      this.finished = true;
    }
  }
}
