import { Distance, HorseAvoidanceVector } from "./raceMath";
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
  maxSpeed: number;
  accel: number;
  maxAccel: number;
  stamina: number;
  maxStamina: number;
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
    this.maxSpeed = horse.speed;
    this.accel = 0.2;
    this.maxAccel = 0.2;
    this.stamina = horse.stamina ?? 100;
    this.maxStamina = horse.stamina ?? 100;
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
    this.states.set("maintainingPace", new MaintainingPaceState(this));
    this.states.set("overtaking", new OvertakingState(this));
    this.states.set("blocked", new BlockedState(this));
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
    const horseAvoidanceVector = HorseAvoidanceVector(this, otherHorses);
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

  moveOnTrack(otherHorses: RaceHorse[]): void {
    this.cooldownsTick(1);
    for (const state of this.states.values()) {
      state.execute(otherHorses);
    }
    if (this.accel > 0) {
      this.stamina -= 0.1;
    } else {
      this.stamina += 0.05;
    }
    this.stamina = Math.max(0, Math.min(this.stamina, this.maxStamina));
    const staminaRatio = this.stamina / this.maxStamina;
    const staminaEffect =
      staminaRatio >= 0.5 ? 1.0 : Math.max(0.3, staminaRatio * 2);
    const currentMaxSpeed = this.maxSpeed * staminaEffect;
    this.speed += this.accel;
    this.speed = Math.max(0, Math.min(this.speed, currentMaxSpeed));
    this.x += Math.cos(this.heading) * this.speed;
    this.y += Math.sin(this.heading) * this.speed;
    this.distance += this.speed;
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }

  findClosestHorseInFront(otherHorses: RaceHorse[]): RaceHorse | null {
    let closestHorse: RaceHorse | null = null;
    let minDistance = Infinity;
    for (const other of otherHorses) {
      if (other.id === this.id) {
        continue;
      }
      if (other.distance > this.distance) {
        const distance = Distance(other, this);
        if (distance < minDistance) {
          minDistance = distance;
          closestHorse = other;
        }
      }
    }
    return closestHorse;
  }

  shouldAttemptOvertake(otherHorse: RaceHorse): boolean {
    const distanceToTarget = Distance(otherHorse, this);
    const isCloseEnough = distanceToTarget < 40 && distanceToTarget > 5;
    const hasEnoughStamina = this.stamina > 40;
    const isNotCurrentlyOvertaking = !this.isActiveState("overtaking");
    return isCloseEnough && hasEnoughStamina && isNotCurrentlyOvertaking;
  }

  private cooldownsTick(tick: number): void {
    for (const state of this.states.values()) {
      state.cooldownTick(tick);
    }
  }

  canActivateState(stateName: HorseStateType): boolean {
    const state = this.states.get(stateName);
    if (!state) {
      return false;
    }
    return state.isOnCooldown() === false;
  }

  activateState(stateName: HorseStateType, data?: any): void {
    const state = this.states.get(stateName);
    if (state && this.canActivateState(stateName)) {
      state.enter(data);
    }
  }

  deactivateState(stateName: HorseStateType): void {
    const state = this.states.get(stateName);
    if (!state) {
      return;
    }
    state.exit();
  }

  isActiveState(stateName: HorseStateType): boolean {
    const state = this.states.get(stateName);
    if (!state) {
      return false;
    }
    return state.isActiveState();
  }
}
