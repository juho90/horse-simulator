import { raycastBoundary, RaycastResult } from "./raceRaycastUtil";
import { RaceSegment } from "./raceSegment";
import { Horse } from "./types/horse";

const DIRECTIONS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
const TRACK_WIDTH = 40;

export class RaceHorse implements Horse {
  id: number;
  name: string;
  speed: number;
  acceleration: number;
  maxAcceleration: number;
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
  riskLevel: number = 0;
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
    this.maxAcceleration = 0.2;
    this.maxSpeed = h.speed;
    this.stamina = h.stamina;
    this.reaction = h.reaction;
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const firstSegment = segments[0];
    const startDir = firstSegment.getEndTangentDirection();
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

  static lerpAngle(a: number, b: number, t: number): number {
    const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + diff * t;
  }

  closestRaycast: RaycastResult | null = null;
  farthestRaycast: RaycastResult | null = null;

  findDirOnTrack(): { moveDir: number; riskWeight: number } {
    const nextSegmentIndex = (this.segmentIndex + 1) % this.segments.length;
    const nextSegment = this.segments[nextSegmentIndex];
    const { closestRaycast, farthestRaycast } = raycastBoundary(
      this.x,
      this.y,
      this.heading,
      [this.segment, nextSegment],
      TRACK_WIDTH,
      DIRECTIONS
    );
    this.closestRaycast = closestRaycast;
    this.farthestRaycast = farthestRaycast;
    return this.findDirOnTrackWithRays(closestRaycast, farthestRaycast);
  }

  findDirOnTrackWithRays(
    closestRaycast: RaycastResult | null,
    farthestRaycast: RaycastResult | null
  ): { moveDir: number; riskWeight: number } {
    if (this.speed <= 0) {
      return { moveDir: this.heading, riskWeight: 0 };
    }
    const safeDist = this.speed * 1.5;
    let riskWeight = 0;
    if (closestRaycast) {
      riskWeight += Math.max(
        0,
        1 - closestRaycast.hitDistance / (safeDist * 1.2)
      );
    }
    if (farthestRaycast) {
      riskWeight += Math.max(
        0,
        1 - farthestRaycast.hitDistance / (safeDist * 1.2)
      );
    }
    let targetX = this.segment.end.x;
    let targetY = this.segment.end.y;
    if (riskWeight > 0.5 && closestRaycast) {
      targetX =
        this.x +
        Math.cos(closestRaycast.rayAngle) * (safeDist * (1 + riskWeight));
      targetY =
        this.y +
        Math.sin(closestRaycast.rayAngle) * (safeDist * (1 + riskWeight));
    } else if (riskWeight > 0.5 && farthestRaycast) {
      targetX =
        this.x +
        Math.cos(farthestRaycast.rayAngle) * (safeDist * (1 + riskWeight));
      targetY =
        this.y +
        Math.sin(farthestRaycast.rayAngle) * (safeDist * (1 + riskWeight));
    }
    const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
    const courseAngle = this.segment.getTangentDirectionAt(this.x, this.y);
    let farthestCourseAngle = courseAngle;
    if (farthestRaycast) {
      farthestCourseAngle = farthestRaycast.segment.getTangentDirectionAt(
        farthestRaycast.hitPoint.x,
        farthestRaycast.hitPoint.y
      );
    }
    let moveDir = courseAngle;
    if (riskWeight < 0.3) {
      // 위험이 낮을 때만 목표점과 코스 방향을 blending
      const blend1 = RaceHorse.lerpAngle(targetAngle, courseAngle, 0.3);
      moveDir = RaceHorse.lerpAngle(blend1, farthestCourseAngle, 0.2);
    } else if (riskWeight < 0.7) {
      // 중간 위험도에서는 목표점과 코스 방향을 약하게 blending
      moveDir = RaceHorse.lerpAngle(targetAngle, courseAngle, 0.7);
    } // 위험도가 높으면 courseAngle을 그대로 사용
    return { moveDir, riskWeight };
  }

  moveOnTrack(tolerance: number): void {
    if (this.segment.isEndAt(this.x, this.y, tolerance)) {
      this.moveNextSegment();
    }
    const { moveDir, riskWeight } = this.findDirOnTrack();
    this.riskLevel = riskWeight;
    if (this.riskLevel > 0.7) {
      // 위험도가 높으면 감속(음수 가속도)
      this.acceleration = -this.maxAcceleration * this.riskLevel;
    } else if (this.riskLevel < 0.2) {
      // 위험도가 낮으면 최대 가속
      this.acceleration = this.maxAcceleration;
    } else {
      // 중간 위험도에서는 가속도 감소
      this.acceleration = this.maxAcceleration * (1 - this.riskLevel);
    }
    this.speed = Math.max(
      Math.min(this.speed + this.acceleration, this.maxSpeed),
      0
    );
    this.x += Math.cos(moveDir) * this.speed;
    this.y += Math.sin(moveDir) * this.speed;
    this.segment.courseEffect(this.x, this.y, this.speed);
    this.heading = moveDir;
    this.distance += this.speed;
  }
}
