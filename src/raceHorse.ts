import { RaceSegment } from "./raceSegment";
import { raycastBoundary, RaycastResult } from "./raceSimulator";
import { Horse } from "./types/horse";

const TRACK_WIDTH = 80;

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

  constructor(horse: Horse, segments: RaceSegment[], gate: number) {
    this.id = horse.id;
    this.name = horse.name;
    this.speed = 0;
    this.acceleration = 0.2;
    this.maxAcceleration = 0.2;
    this.maxSpeed = horse.speed;
    this.stamina = horse.stamina;
    this.reaction = horse.reaction;
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const firstSegment = segments[0];
    const startDir = firstSegment.getEndTangentDirection();
    let baseX = firstSegment.start.x;
    let baseY = firstSegment.start.y;
    let ortho = firstSegment.orthoVectorAt(baseX, baseY);
    const gateOffset = 5 + gate * 5;
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
      this.segment,
      nextSegment,
      TRACK_WIDTH
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
    const courseAngle = this.segment.getTangentDirectionAt(this.x, this.y);
    let moveDir = courseAngle;
    if (farthestRaycast) {
      const farthestAngle = farthestRaycast.rayAngle;
      if (riskWeight < 0.2) {
        // 위험도가 매우 낮으면 farthestRaycast.rayAngle을 거의 그대로 사용
        moveDir = RaceHorse.lerpAngle(courseAngle, farthestAngle, 0.9);
      } else if (riskWeight < 0.7) {
        // 중간 위험도에서는 blending
        const blendRatio = 0.5 * (1 - riskWeight);
        moveDir = RaceHorse.lerpAngle(courseAngle, farthestAngle, blendRatio);
      } // 위험도가 높으면 courseAngle만 사용
    }
    return { moveDir, riskWeight };
  }

  moveOnTrack(): void {
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
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }
}
