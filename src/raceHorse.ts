import { Horse } from "./horse";
import { RaceEnvironment } from "./raceEnvironment";
import { Distance } from "./raceMath";
import { RaceSegment } from "./raceSegment";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";
import { RaceStrategyPlan } from "./raceStrategyPlan";
import { BlockedState } from "./states/blockedState";
import { HorseState, HorseStateType } from "./states/horseState";
import { MaintainingPaceState } from "./states/maintainingPaceState";
import { OvertakingState } from "./states/overtakingState";

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
  segments: RaceSegment[];
  segment: RaceSegment;
  segmentIndex: number;
  gate: number;
  x: number;
  y: number;
  raceHeading: number;
  raceDistance: number;
  lap: number = 0;
  finished: boolean = false;

  states: Map<HorseStateType, HorseState>;

  raceEnvironment: RaceEnvironment;
  raceSituationAnalysis: RaceSituationAnalysis;
  raceStrategyPlan: RaceStrategyPlan;

  constructor(horse: Horse, segments: RaceSegment[], gate: number) {
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
    const gateOffset = (this.gate + 1) * 17;
    this.x = this.segment.start.x + ortho.x * gateOffset;
    this.y = this.segment.start.y + ortho.y * gateOffset;

    this.raceHeading = startDir;
    this.raceDistance = 0;

    this.states = new Map();
    this.states.set("maintainingPace", new MaintainingPaceState(this));
    this.states.set("overtaking", new OvertakingState(this));
    this.states.set("blocked", new BlockedState(this));

    // Initialize AI Components
    this.raceEnvironment = new RaceEnvironment(this);
    this.raceSituationAnalysis = new RaceSituationAnalysis(
      this,
      this.raceEnvironment
    );
    this.raceStrategyPlan = new RaceStrategyPlan(
      this,
      this.raceSituationAnalysis
    );

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

  moveOnTrack(otherHorses: RaceHorse[]): void {
    this.cooldownsTick(1);

    const activeState = this.getActiveState();
    if (activeState) {
      activeState.execute(otherHorses);
    }

    if (this.accel > 0) {
      this.stamina -= this.staminaConsumption;
    } else if (this.speed > 0) {
      this.stamina -= this.staminaConsumption * 0.5;
    } else {
      this.stamina += this.staminaRecovery * 2;
    }
    if (this.accel < 0) {
      this.stamina += this.staminaRecovery * 0.5;
    }
    this.stamina = Math.max(0, Math.min(this.stamina, this.maxStamina));
    const staminaRatio = this.stamina / this.maxStamina;
    const staminaEffect =
      staminaRatio >= 0.5 ? 1.0 : Math.max(0.3, staminaRatio * 2);
    const currentMaxSpeed = this.maxSpeed * staminaEffect;
    this.speed += this.accel;
    this.speed = Math.max(0, Math.min(this.speed, currentMaxSpeed));
    if (
      staminaRatio > 0.6 &&
      this.speed < currentMaxSpeed * 0.85 &&
      this.accel >= 0
    ) {
      const recoveryAccel = this.maxAccel * 0.5;
      this.speed = Math.min(this.speed + recoveryAccel, currentMaxSpeed);
    }
    this.x += Math.cos(this.raceHeading) * this.speed;
    this.y += Math.sin(this.raceHeading) * this.speed;
    this.raceDistance += this.speed;
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }

  findClosestHorseInFront(otherHorses: RaceHorse[]): RaceHorse | null {
    let closestHorse: RaceHorse | null = null;
    let minDistance = Infinity;
    for (const other of otherHorses) {
      if (other.horseId === this.horseId) {
        continue;
      }
      if (other.raceDistance > this.raceDistance) {
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

  getActiveState(): HorseState | null {
    for (const state of this.states.values()) {
      if (state.isActiveState()) {
        return state;
      }
    }
    return null;
  }

  updateEnvironment(otherHorses: RaceHorse[]): RaceEnvironment {
    this.raceEnvironment.update(otherHorses);
    return this.raceEnvironment;
  }

  updateAnalyzeSituation(): RaceSituationAnalysis {
    this.raceSituationAnalysis.update();
    return this.raceSituationAnalysis;
  }

  updatePlanStrategy(): RaceStrategyPlan {
    this.raceStrategyPlan.update();
    return this.raceStrategyPlan;
  }
}
