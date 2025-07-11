import { findBoundaryDirections } from "./raceRaycastUtil";
import { RaceSegment } from "./raceSegment";
import { Horse } from "./types/horse";

export class RaceHorse implements Horse {
  id: number;
  name: string;
  speed: number;
  acceleration: number;
  maxSpeed: number;
  stamina?: number;
  reaction?: number;
  segments: RaceSegment[];
  segment: RaceSegment;
  segmentIndex: number;
  gate: number;
  x: number;
  y: number;
  heading: number;
  distance: number;
  lap: number = 0;
  finished: boolean = false;

  constructor(
    h: Horse,
    segments: RaceSegment[],
    fullGate: number,
    gate: number
  ) {
    this.id = h.id;
    this.name = h.name;
    this.speed = 0;
    this.acceleration = 0.2;
    this.maxSpeed = h.speed;
    this.stamina = h.stamina;
    this.reaction = h.reaction;
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const firstSegment = segments[0];
    const startDir = firstSegment.getDirection();
    const TRACK_WIDTH = 40;
    let baseX = firstSegment.start.x;
    let baseY = firstSegment.start.y;
    let ortho = firstSegment.orthoVectorAt(baseX, baseY);
    const gateFrac = fullGate === 1 ? 0.5 : gate / (fullGate - 1);
    const gateOffset = gateFrac * (TRACK_WIDTH - 6);
    this.x = baseX + ortho.x * gateOffset;
    this.y = baseY + ortho.y * gateOffset;
    this.heading = startDir;
    this.distance = 0;
  }

  moveNextSegment() {
    const prevIndex = this.segmentIndex;
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segment = this.segments[this.segmentIndex];
    if (prevIndex !== 0 && this.segmentIndex === 0) {
      this.lap++;
    }
  }

  moveOnTrack(tolerance: number): void {
    if (!this.segment.isInner(this.x, this.y)) {
      const clamped = this.segment.clampToTrackBoundary(this.x, this.y);
      this.x = clamped.x;
      this.y = clamped.y;
    }
    if (this.segment.isEndAt(this.x, this.y, tolerance)) {
      this.moveNextSegment();
    }
    const targetX = this.segment.end.x;
    const targetY = this.segment.end.y;
    const targetDir = Math.atan2(targetY - this.y, targetX - this.x);
    const directions = [
      0,
      Math.PI / 4,
      -Math.PI / 4,
      Math.PI / 2,
      -Math.PI / 2,
    ];
    const boundaryResults = findBoundaryDirections(
      this.x,
      this.y,
      this.heading,
      this.segments,
      "inner",
      40,
      directions
    );
    const candidates = boundaryResults.filter((r) => {
      const angleDiff = Math.abs(
        Math.atan2(Math.sin(targetDir - r.angle), Math.cos(targetDir - r.angle))
      );
      return r.dist > this.speed * 1.5 && angleDiff <= Math.PI / 2;
    });
    let moveDir = this.heading;
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => {
        const aDiff = Math.abs(
          Math.atan2(
            Math.sin(targetDir - a.angle),
            Math.cos(targetDir - a.angle)
          )
        );
        const bDiff = Math.abs(
          Math.atan2(
            Math.sin(targetDir - b.angle),
            Math.cos(targetDir - b.angle)
          )
        );
        return aDiff < bDiff ? a : b;
      });
      moveDir = best.angle;
    } else {
      const front = boundaryResults[0];
      if (front.dist < this.speed * 1.5) {
        const best = boundaryResults.reduce((a, b) =>
          a.dist > b.dist ? a : b
        );
        moveDir = best.angle;
      }
    }
    this.x += Math.cos(moveDir) * this.speed;
    this.y += Math.sin(moveDir) * this.speed;
    this.heading = moveDir;
    this.distance += this.speed;
    // 가속 적용
    this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
    if (!this.segment.isInner(this.x, this.y)) {
      const clamped = this.segment.clampToTrackBoundary(this.x, this.y);
      this.x = clamped.x;
      this.y = clamped.y;
    }
  }
}
