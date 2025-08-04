import { Horse } from "./horse";
import { LerpAngle, NormalizeTheta } from "./raceMath";
import { findNearestNodeIndex, isNextNode } from "./racePathfinder";
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

  path: RaceSegmentNode[] = [];
  private currentNodeIndex: number | null = null;

  constructor(horse: Horse, gate: number, firstSegment: RaceSegment) {
    const gateOffset = (gate + 1) * 17;
    const ortho = firstSegment.getOrthoVectorAt(firstSegment.start);
    const x = firstSegment.start.x + ortho.x * gateOffset;
    const y = firstSegment.start.y + ortho.y * gateOffset;
    const raceHeading = firstSegment.getTangentDirectionAt(firstSegment.start);
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

  checkRefreshPath(track: RaceTrack, others: RaceHorse[]): boolean {
    const currentNode = this.getCurrentNode();
    if (!currentNode) {
      return true;
    }
    return false;
  }

  refreshPath(track: RaceTrack, path: RaceSegmentNode[]): void {
    if (path.length === 0) {
      return;
    }
    const currentNodeIndex = findNearestNodeIndex(
      this,
      this.progress,
      track,
      path
    );
    this.path = path;
    this.currentNodeIndex = currentNodeIndex;
  }

  moveOnTrack(turn: number, track: RaceTrack, others: RaceHorse[]): void {
    const targetNode = this.getCurrentNode();
    if (!targetNode) {
      return;
    }
    const segment = track.getSegment(targetNode.segmentIndex);
    const nodeHeading = NormalizeTheta(this, targetNode);
    const segmentHeading = segment.getTangentDirectionAt(this);
    const raceHeading = LerpAngle(
      nodeHeading,
      segmentHeading,
      this.progress / targetNode.progress
    );
    const accel = Math.min(this.accel + 0.2, this.maxAccel);
    const speed = Math.min(this.speed + accel, this.maxSpeed);
    const x = this.x + Math.cos(raceHeading) * speed;
    const y = this.y + Math.sin(raceHeading) * speed;
    const progress = track.getTrackProgress(segment.segmentIndex, { x, y });
    let currentNodeIndex = this.currentNodeIndex ?? 0;
    if (isNextNode(targetNode.progress, progress)) {
      currentNodeIndex = findNearestNodeIndex(this, progress, track, this.path);
    }
    this.accel = accel;
    this.speed = speed;
    this.x = x;
    this.y = y;
    this.raceHeading = raceHeading;
    this.raceDistance += this.speed;
    this.progress = progress;
    this.currentNodeIndex = currentNodeIndex;
  }

  private getCurrentNode(): RaceSegmentNode | null {
    if (
      this.currentNodeIndex === null ||
      this.currentNodeIndex < 0 ||
      this.path.length <= this.currentNodeIndex
    ) {
      return null;
    }
    return this.path[this.currentNodeIndex];
  }
}
