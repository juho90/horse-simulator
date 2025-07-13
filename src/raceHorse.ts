import { lerpAngle as LerpAngle } from "./raceMath";
import { RaceSegment } from "./raceSegment";
import { raycastBoundary, RaycastResult } from "./raceSimulator";
import { Horse } from "./types/horse";

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
    const startDir = this.segment.getTangentDirectionAt(
      this.segment.start.x,
      this.segment.start.y
    );
    let ortho = this.segment.orthoVectorAt(
      this.segment.start.x,
      this.segment.start.y
    );
    const gateOffset = (this.gate - 1) * 5;
    this.x = this.segment.start.x + ortho.x * gateOffset;
    this.y = this.segment.start.y + ortho.y * gateOffset;
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
  closestRaycasts: RaycastResult[] | null = null;
  farthestRaycast: RaycastResult | null = null;
  findDirOnTrack(): { moveDir: number; riskWeight: number } {
    const nextSegmentIndex = (this.segmentIndex + 1) % this.segments.length;
    const nextSegment = this.segments[nextSegmentIndex];
    const { closestRaycasts, farthestRaycast } = raycastBoundary(
      this.x,
      this.y,
      this.heading,
      this.segment,
      nextSegment
    );
    this.closestRaycasts = closestRaycasts;
    this.farthestRaycast = farthestRaycast;
    return this.findDirOnTrackWithRays(closestRaycasts);
  }

  findDirOnTrackWithRays(closestRaycasts: RaycastResult[]): {
    moveDir: number;
    riskWeight: number;
  } {
    if (this.speed <= 0) {
      return { moveDir: this.heading, riskWeight: 0 };
    }
    const courseAngle = this.segment.getTangentDirectionAt(this.x, this.y);
    if (!closestRaycasts || closestRaycasts.length === 0) {
      return { moveDir: courseAngle, riskWeight: 0 };
    }
    let avoidanceVector = { x: 0, y: 0 };
    let minDistance = Infinity;
    for (const ray of closestRaycasts) {
      minDistance = Math.min(minDistance, ray.hitDistance);
      if (ray.hitDistance > 0) {
        const forceMagnitude = 1 / (ray.hitDistance * ray.hitDistance);
        const forceAngle = ray.angle + Math.PI;
        avoidanceVector.x += Math.cos(forceAngle) * forceMagnitude;
        avoidanceVector.y += Math.sin(forceAngle) * forceMagnitude;
      }
    }
    const RISK_DISTANCE = 20.0;
    let riskWeight = 0;
    if (minDistance < RISK_DISTANCE) {
      riskWeight = Math.pow(1 - minDistance / RISK_DISTANCE, 2);
    }
    const baseGoalForce = 0.01;
    const maxGoalForce = 0.1;
    const goalForce =
      baseGoalForce + (maxGoalForce - baseGoalForce) * riskWeight;
    const goalVector = {
      x: Math.cos(courseAngle) * goalForce,
      y: Math.sin(courseAngle) * goalForce,
    };
    const finalVector = {
      x: goalVector.x + avoidanceVector.x,
      y: goalVector.y + avoidanceVector.y,
    };
    const bestDir = Math.atan2(finalVector.y, finalVector.x);
    return { moveDir: bestDir, riskWeight };
  }

  moveOnTrack(): void {
    const { moveDir, riskWeight } = this.findDirOnTrack();
    this.riskLevel = riskWeight;
    let cornerAnticipationFactor = 0;
    const LOOK_AHEAD_DISTANCE = 150;
    if (
      this.farthestRaycast &&
      this.farthestRaycast.hitDistance < LOOK_AHEAD_DISTANCE
    ) {
      cornerAnticipationFactor = Math.pow(
        1 - this.farthestRaycast.hitDistance / LOOK_AHEAD_DISTANCE,
        2
      );
    }
    const speedReduction = Math.max(
      riskWeight * 0.5,
      cornerAnticipationFactor * 0.7
    );
    const targetSpeed = this.maxSpeed * (1 - speedReduction);
    const TTC_THRESHOLD = 2.0;
    let collisionImminent = false;
    if (this.speed > 1 && this.farthestRaycast) {
      const timeToCollision = this.farthestRaycast.hitDistance / this.speed;
      if (timeToCollision < TTC_THRESHOLD) {
        collisionImminent = true;
      }
    }
    if (collisionImminent) {
      this.acceleration = -this.maxAcceleration;
    } else if (this.speed > targetSpeed) {
      this.acceleration = -this.maxAcceleration;
    } else {
      this.acceleration = this.maxAcceleration;
    }
    this.speed += this.acceleration;
    this.speed = Math.max(0, Math.min(this.speed, this.maxSpeed));
    this.heading = LerpAngle(this.heading, moveDir, 0.4);
    this.x += Math.cos(this.heading) * this.speed;
    this.y += Math.sin(this.heading) * this.speed;
    this.distance += this.speed;
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }
}
