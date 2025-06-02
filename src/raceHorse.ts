import { Horse } from "./horse";
import { TrackCorner } from "./interfaces";
import { RaceTrack } from "./raceTrack";
import { RACE_VALUES, RacePhase } from "./raceValues";

export class RaceHorse {
  // --- 고정 스탯 ---
  public name: string;
  public lane: number; // gate -> lane
  public baseSpeed: number;
  public stamina: number;
  public weight: number;
  public temperament: number;
  public cornering: number;
  public positioning: number;
  public paceSense: number;
  public burst: number;
  public maxSpeed: number;
  public acceleration: number;

  // --- 경주 중 동적 상태 ---
  public distance = 0; // 단위: 100 = 1m
  public staminaLeft: number;
  public isSpurting = false;
  public currentSpeed = 0;
  public ignoreStaminaPenalty = false;
  public slipstreamSpeedBonus = 0;
  public slipstreamAccelBonus = 0;
  public lastSpurtAccelBonus = 0;

  constructor(horse: Horse, lane: number) {
    this.name = horse.name;
    this.lane = lane;
    this.baseSpeed = horse.stats.speed;
    this.stamina = horse.stats.stamina;
    this.weight = horse.stats.weight;
    this.temperament = horse.stats.temperament;
    this.cornering = horse.stats.cornering;
    this.positioning = horse.stats.positioning;
    this.paceSense = horse.stats.paceSense;
    this.burst = this.baseSpeed * 0.7 - this.weight * 0.3;
    this.maxSpeed = this.baseSpeed + this.burst * 0.5 + this.temperament * 0.2;
    this.acceleration = this.burst * 0.07 + this.temperament * 0.03;
    this.staminaLeft = this.stamina;
  }

  private randomVariance(): number {
    return Math.random() - RACE_VALUES.RANDOM_BASE;
  }

  consumeStaminaByPhase(phase: RacePhase): void {
    if (phase === RacePhase.Early) {
      this.staminaLeft -= RACE_VALUES.EARLY_PHASE_STAMINA;
    } else if (phase === RacePhase.Middle) {
      this.staminaLeft -= RACE_VALUES.MIDDLE_PHASE_STAMINA;
    } else {
      if (this.isSpurting && this.staminaLeft > 0) {
        this.staminaLeft -= RACE_VALUES.FINAL_PHASE_SPURT_STAMINA;
      } else {
        this.staminaLeft -= RACE_VALUES.FINAL_PHASE_STAMINA;
      }
    }
  }

  private applyLowStaminaSpeedPenalty(speed: number): number {
    if (this.ignoreStaminaPenalty) {
      return speed;
    }
    const staminaThreshold = this.stamina * RACE_VALUES.STAMINA_PENALTY_RATIO;
    const isLowStamina = this.staminaLeft < staminaThreshold;
    if (isLowStamina) {
      return speed * RACE_VALUES.LOW_STAMINA_SPEED;
    }
    return speed;
  }

  private applyWeightSpeedPenalty(speed: number): number {
    const penalty = this.weight * RACE_VALUES.WEIGHT_PENALTY;
    return speed - penalty;
  }

  private applyTemperamentVariance(speed: number): number {
    const temperamentVariance =
      this.temperament * RACE_VALUES.TEMPERAMENT_VARIANCE;
    const variance = this.randomVariance() * temperamentVariance;
    return speed + variance;
  }

  private getCurrentAcceleration(): number {
    return (
      this.acceleration + this.slipstreamAccelBonus + this.lastSpurtAccelBonus
    );
  }

  private getPhaseGoalSpeed(phase: RacePhase): number {
    let speed = this.getBasePhaseSpeed(phase);
    speed += this.slipstreamSpeedBonus;
    speed += this.lastSpurtAccelBonus;
    speed = this.applyLowStaminaSpeedPenalty(speed);
    speed = this.applyWeightSpeedPenalty(speed);
    speed = this.applyTemperamentVariance(speed);
    return Math.min(speed, this.maxSpeed);
  }

  private getBasePhaseSpeed(phase: RacePhase): number {
    if (phase === RacePhase.Early) {
      return this.baseSpeed * RACE_VALUES.EARLY_PHASE_SPEED;
    }
    if (phase === RacePhase.Middle) {
      return this.baseSpeed * RACE_VALUES.MIDDLE_PHASE_SPEED;
    }
    if (this.isSpurting && this.staminaLeft > 0) {
      return this.baseSpeed + this.burst * RACE_VALUES.FINAL_PHASE_SPURT_BONUS;
    }
    return this.baseSpeed;
  }

  private getMoveDistanceByTargetSpeed(targetSpeed: number): number {
    const effectiveAcceleration = this.getCurrentAcceleration();
    let nextSpeed: number;
    if (this.currentSpeed < targetSpeed) {
      nextSpeed = this.currentSpeed + effectiveAcceleration;
      if (nextSpeed > targetSpeed) {
        nextSpeed = targetSpeed;
      }
      if (nextSpeed > this.maxSpeed) {
        nextSpeed = this.maxSpeed;
      }
      this.currentSpeed = nextSpeed;
    } else {
      nextSpeed = this.currentSpeed - effectiveAcceleration;
      if (nextSpeed < targetSpeed) {
        nextSpeed = targetSpeed;
      }
      if (nextSpeed < 0) {
        nextSpeed = 0;
      }
      this.currentSpeed = nextSpeed;
    }
    const minMoveFactor = RACE_VALUES.MOVE_FACTOR_MIN;
    const moveFactorRange = RACE_VALUES.MOVE_FACTOR_RANGE;
    const randomValue = Math.random();
    const moveFactor = minMoveFactor + randomValue * moveFactorRange;
    let moveDistance = this.currentSpeed * moveFactor * RACE_VALUES.UNIT;
    if (moveDistance < 0) {
      moveDistance = 0;
    }
    return moveDistance;
  }

  public getCornerOvertakePower(difficulty: number): number {
    let basePower =
      this.cornering +
      this.positioning +
      this.temperament +
      this.randomVariance();
    basePower *= difficulty;
    return basePower;
  }

  private updateForTurn(phase: RacePhase) {
    const targetSpeed = this.getPhaseGoalSpeed(phase);
    this.consumeStaminaByPhase(phase);
    const move = this.getMoveDistanceByTargetSpeed(targetSpeed);
    this.distance += move;
  }

  static isInCornerSection(distance: number, corner: TrackCorner): boolean {
    return distance >= corner.start && distance < corner.end;
  }

  public isLaneBlocked(horses: RaceHorse[], targetLane: number): boolean {
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      const sameLane = h.lane === targetLane;
      const diff = Math.abs(h.distance - this.distance);
      const blocked = sameLane && diff < RACE_VALUES.CLOSE_POSITION_BLOCK;
      if (blocked) {
        return true;
      }
    }
    return false;
  }

  public getInnerHorseInLane(
    horses: RaceHorse[],
    targetLane: number
  ): RaceHorse | undefined {
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      const sameLane = h.lane === targetLane;
      const diff = Math.abs(h.distance - this.distance);
      const isInner = sameLane && diff < RACE_VALUES.CLOSE_POSITION_INNER;
      if (isInner) {
        return h;
      }
    }
    return undefined;
  }

  public getClosestHorseAheadInLane(
    horses: RaceHorse[]
  ): RaceHorse | undefined {
    let closestAhead: RaceHorse | undefined = undefined;
    for (let i = 0; i < horses.length; i++) {
      const other = horses[i];
      const sameLane = other.lane === this.lane;
      const ahead = other.distance > this.distance;
      if (sameLane && ahead) {
        if (!closestAhead || other.distance < closestAhead.distance) {
          closestAhead = other;
        }
      }
    }
    return closestAhead;
  }

  public getSlipstreamBonus(horses: RaceHorse[]): {
    speed: number;
    accel: number;
  } {
    const sameLaneAhead = this.getClosestHorseAheadInLane(horses);
    if (!sameLaneAhead) {
      return { speed: 0, accel: 0 };
    }
    const distanceToAhead = sameLaneAhead.distance - this.distance;
    const inSlipstreamZone =
      distanceToAhead >= RACE_VALUES.SLIPSTREAM_MIN_DIST &&
      distanceToAhead <= RACE_VALUES.SLIPSTREAM_MAX_DIST;
    let slipstreamBonus = 0;
    let accelBonus = 0;
    if (inSlipstreamZone) {
      slipstreamBonus = RACE_VALUES.SLIPSTREAM_SPEED_BONUS;
      accelBonus = RACE_VALUES.SLIPSTREAM_ACCEL_BONUS;
    }
    return { speed: slipstreamBonus, accel: accelBonus };
  }

  public updateRaceState(track: RaceTrack, horses: RaceHorse[]): void {
    const { phase, lastSpurtAccel, ignoreStaminaPenalty } =
      track.getPhaseEffectInfo(this);
    const { speed, accel } = this.getSlipstreamBonus(horses);
    this.slipstreamSpeedBonus = speed;
    this.slipstreamAccelBonus = accel;
    this.lastSpurtAccelBonus = lastSpurtAccel;
    this.ignoreStaminaPenalty = ignoreStaminaPenalty;
    this.updateForTurn(phase);
  }
}
