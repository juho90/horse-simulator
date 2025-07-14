import { RaceSegment } from "./raceSegment";
import { raycastBoundary, RaycastResult } from "./raceSimulator";
import { BlockedState } from "./states/blockedState";
import { HorseState, HorseStateType } from "./states/horseState";
import { MaintainingPaceState } from "./states/maintainingPaceState";
import { OvertakingState } from "./states/overtakingState";
import { Horse } from "./types/horse";

export class RaceHorse implements Horse {
  id: number;
  name: string;
  speed: number;
  acceleration: number;
  maxAcceleration: number;
  maxSpeed: number;
  stamina: number;
  maxStamina: number;
  currentStamina: number;
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
  states: Map<HorseStateType, HorseState>;

  constructor(horse: Horse, segments: RaceSegment[], gate: number) {
    this.id = horse.id;
    this.name = horse.name;
    this.speed = 0;
    this.acceleration = 0.2;
    this.maxAcceleration = 0.2;
    this.maxSpeed = horse.speed;
    this.stamina = horse.stamina ?? 100;
    this.maxStamina = horse.stamina ?? 100;
    this.currentStamina = this.maxStamina;
    this.reaction = horse.reaction;
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const startDir = this.segment.getTangentDirectionAt(
      this.segment.start.x,
      this.segment.start.y
    );
    const ortho = this.segment.orthoVectorAt(
      this.segment.start.x,
      this.segment.start.y
    );
    const gateOffset = (this.gate + 1) * 5;
    this.x = this.segment.start.x + ortho.x * gateOffset;
    this.y = this.segment.start.y + ortho.y * gateOffset;
    this.heading = startDir;
    this.distance = 0;
    this.states = new Map();
    this.states.set("maintainingPace", new MaintainingPaceState());
    this.states.set("overtaking", new OvertakingState());
    this.states.set("blocked", new BlockedState());
    const initialState = this.states.get("maintainingPace")!;
    initialState.enter(this);
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
  findDirOnTrack(otherHorses: RaceHorse[]): {
    moveDir: number;
    riskWeight: number;
  } {
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
    return this.findDirOnTrackWithRays(closestRaycasts, otherHorses);
  }

  getHorseAvoidanceVector(otherHorses: RaceHorse[]): { x: number; y: number } {
    let avoidanceVector = { x: 0, y: 0 };
    const AVOID_DISTANCE = 30;
    for (const other of otherHorses) {
      if (other.id === this.id) {
        continue;
      }
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < AVOID_DISTANCE && distance > 0) {
        const angleToOther = Math.atan2(dy, dx);
        let relativeAngle = angleToOther - this.heading;
        while (relativeAngle <= -Math.PI) {
          relativeAngle += 2 * Math.PI;
        }
        while (relativeAngle > Math.PI) {
          relativeAngle -= 2 * Math.PI;
        }
        if (Math.abs(relativeAngle) < Math.PI / 2) {
          const forceMagnitude = (1 / (distance * distance)) * 0.5;
          const forceAngle = angleToOther + Math.PI;
          avoidanceVector.x += Math.cos(forceAngle) * forceMagnitude;
          avoidanceVector.y += Math.sin(forceAngle) * forceMagnitude;
        }
      }
    }
    return avoidanceVector;
  }

  findDirOnTrackWithRays(
    closestRaycasts: RaycastResult[],
    otherHorses: RaceHorse[]
  ): {
    moveDir: number;
    riskWeight: number;
  } {
    if (this.speed <= 0) {
      return { moveDir: this.heading, riskWeight: 0 };
    }
    const courseAngle = this.segment.getTangentDirectionAt(this.x, this.y);
    let wallAvoidanceVector = { x: 0, y: 0 };
    let minDistance = Infinity;
    if (closestRaycasts) {
      for (const ray of closestRaycasts) {
        minDistance = Math.min(minDistance, ray.hitDistance);
        if (ray.hitDistance > 0) {
          const forceMagnitude = 1 / (ray.hitDistance * ray.hitDistance);
          const forceAngle = ray.angle + Math.PI;
          wallAvoidanceVector.x += Math.cos(forceAngle) * forceMagnitude;
          wallAvoidanceVector.y += Math.sin(forceAngle) * forceMagnitude;
        }
      }
    }
    const horseAvoidanceVector = this.getHorseAvoidanceVector(otherHorses);
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
      x: goalVector.x + wallAvoidanceVector.x + horseAvoidanceVector.x,
      y: goalVector.y + wallAvoidanceVector.y + horseAvoidanceVector.y,
    };
    const bestDir = Math.atan2(finalVector.y, finalVector.x);
    return { moveDir: bestDir, riskWeight };
  }

  getDistanceTo(other: RaceHorse): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  findClosestHorseInFront(otherHorses: RaceHorse[]): RaceHorse | null {
    let closestHorse: RaceHorse | null = null;
    let minDistance = Infinity;
    for (const other of otherHorses) {
      if (other.id === this.id) {
        continue;
      }
      if (other.distance > this.distance) {
        const distance = this.getDistanceTo(other);
        if (distance < minDistance) {
          minDistance = distance;
          closestHorse = other;
        }
      }
    }
    return closestHorse;
  }

  shouldAttemptOvertake(otherHorse: RaceHorse): boolean {
    const distanceToTarget = this.getDistanceTo(otherHorse);
    const isCloseEnough = distanceToTarget < 40 && distanceToTarget > 5;
    const hasEnoughStamina = this.currentStamina > 40;
    const isNotCurrentlyOvertaking = !this.isStateActive("overtaking");
    return isCloseEnough && hasEnoughStamina && isNotCurrentlyOvertaking;
  }

  temporarilyBoostSpeed() {
    this.acceleration = this.maxAcceleration * 1.5;
    this.currentStamina -= 0.5;
  }

  activateState(stateName: HorseStateType, data?: any): void {
    const state = this.states.get(stateName);
    if (state && this.canActivateState(stateName)) {
      state.enter(this, data);
    }
  }

  deactivateState(stateName: HorseStateType): void {
    const state = this.states.get(stateName);
    if (state && state.isActive) {
      state.exit(this);
    }
  }

  isStateActive(stateName: HorseStateType): boolean {
    const state = this.states.get(stateName);
    return state ? state.isActive : false;
  }

  canActivateState(stateName: HorseStateType): boolean {
    const state = this.states.get(stateName);
    return state ? state.cooldown <= 0 : false;
  }

  private updateCooldowns(): void {
    for (const state of this.states.values()) {
      if (state.cooldown > 0) {
        state.cooldown--;
      }
    }
  }

  moveOnTrack(otherHorses: RaceHorse[]): void {
    this.updateCooldowns();
    for (const state of this.states.values()) {
      if (state.isActive) {
        state.execute(this, otherHorses);
      }
    }
    if (this.acceleration > 0) {
      this.currentStamina -= 0.1;
    } else {
      this.currentStamina += 0.05;
    }
    this.currentStamina = Math.max(
      0,
      Math.min(this.currentStamina, this.maxStamina)
    );
    const staminaEffect = Math.max(0.3, this.currentStamina / this.maxStamina);
    const currentMaxSpeed = this.maxSpeed * staminaEffect;
    this.speed += this.acceleration;
    this.speed = Math.max(0, Math.min(this.speed, currentMaxSpeed));
    this.x += Math.cos(this.heading) * this.speed;
    this.y += Math.sin(this.heading) * this.speed;
    this.distance += this.speed;
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }
}
