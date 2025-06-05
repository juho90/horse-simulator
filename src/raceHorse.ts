import {
  HorseOptions,
  HorseProfile,
  HorseStats,
  TrackCorner,
} from "./interfaces";
import { RaceTrack } from "./raceTrack";
import { RACE_SIMULATE_VALUES, RacePhase } from "./raceValues";

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
  public power: number;
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
  public paceSensePenalty = 0; // New: penalty to speed for bad spurt timing
  public hadBadSpurt = false; // New: track if bad spurt timing occurred

  public profile: HorseProfile;
  public stats: HorseStats;

  constructor(horse: HorseOptions, lane: number) {
    this.profile = horse.profile;
    this.stats = horse.stats;
    this.name = horse.profile.name;
    this.lane = lane;
    this.baseSpeed = horse.stats.speed;
    this.stamina = horse.stats.stamina;
    this.weight = horse.profile.weight;
    this.temperament = horse.profile.temperament;
    this.cornering = horse.stats.cornering;
    this.positioning = horse.stats.positioning;
    this.paceSense = horse.stats.paceSense;
    this.power = horse.stats.power;
    this.maxSpeed =
      this.baseSpeed * RACE_SIMULATE_VALUES.MAXSPEED_BASESPEED +
      this.power * RACE_SIMULATE_VALUES.MAXSPEED_POWER +
      this.temperament * RACE_SIMULATE_VALUES.MAXSPEED_TEMPERAMENT;
    this.acceleration =
      this.power * RACE_SIMULATE_VALUES.ACCEL_POWER +
      this.temperament * RACE_SIMULATE_VALUES.ACCEL_TEMPERAMENT;
    this.staminaLeft = this.stamina;
  }

  private randomVariance(): number {
    return Math.random() - RACE_SIMULATE_VALUES.RANDOM_BASE;
  }

  consumeStaminaByPhase(phase: RacePhase): void {
    // 최고속도 도달 비율에 따라 스태미나 소모량 가중치 적용
    const speedRatio = this.currentSpeed / this.maxSpeed;
    // 최소 0.5, 최대 1.5배 (최고속도일 때 1.5배, 정지시 0.5배)
    const staminaWeight = 0.5 + 1.0 * speedRatio;
    let baseStamina = 0;
    if (phase === RacePhase.Early) {
      baseStamina = RACE_SIMULATE_VALUES.EARLY_PHASE_STAMINA;
    } else if (phase === RacePhase.Middle) {
      baseStamina = RACE_SIMULATE_VALUES.MIDDLE_PHASE_STAMINA;
    } else {
      if (this.isSpurting && this.staminaLeft > 0) {
        baseStamina = RACE_SIMULATE_VALUES.FINAL_PHASE_SPURT_STAMINA;
      } else {
        baseStamina = RACE_SIMULATE_VALUES.FINAL_PHASE_STAMINA;
      }
    }
    this.staminaLeft -= baseStamina * staminaWeight;
    if (this.staminaLeft < 0) this.staminaLeft = 0;
  }

  public getCurrentAcceleration(
    isCorner: boolean = false,
    isOvertaking: boolean = false
  ): number {
    let accel =
      this.acceleration + this.slipstreamAccelBonus + this.lastSpurtAccelBonus;
    const staminaRatio = this.staminaLeft / this.stamina;
    if (staminaRatio > 0.3) {
      accel *= 1.5;
    }
    // 코너 구간: 코너링, 포지셔닝이 높으면 추가 가속 보너스
    if (isCorner) {
      const corneringBonus = 0.08 * (this.cornering / 1200); // 최대 0.08배
      const positioningBonus = 0.05 * (this.positioning / 1200); // 최대 0.05배
      accel *= 1 + corneringBonus + positioningBonus;
    }
    // 추월 시도: 포지셔닝이 높으면 추가 가속 보너스
    if (isOvertaking) {
      const positioningBonus = 0.1 * (this.positioning / 1200); // 최대 0.10배
      accel *= 1 + positioningBonus;
    }
    return accel;
  }

  private getPhaseGoalSpeed(phase: RacePhase, track: RaceTrack): number {
    let speed = this.maxSpeed;
    if (phase === RacePhase.Final || this.isSpurting) {
      if (this.staminaLeft <= 0) {
        speed = this.getBasePhaseSpeed(phase);
      }
    } else {
      speed = this.getBasePhaseSpeed(phase);
    }
    // --- 남은 스태미나로 완주 가능성 체크 ---
    if (track) {
      const remainDist = Math.max(track.finishLine - this.distance, 1);
      // 평균 이동거리(보수적으로 현재 속도의 80%로 계산)
      const { MAXSPEED_STAT, SPEED_MPS } = RACE_SIMULATE_VALUES;
      const avgMove = (this.currentSpeed / MAXSPEED_STAT) * SPEED_MPS * 0.8;
      const remainTurn = remainDist / Math.max(avgMove, 0.1);
      // 페이즈별 스태미나 소모(보수적으로 middle phase 기준)
      const perTurnStamina = RACE_SIMULATE_VALUES.MIDDLE_PHASE_STAMINA;
      const expectedStamina = remainTurn * perTurnStamina;
      if (this.staminaLeft < expectedStamina) {
        // 부족하면 속도를 비례해서 줄임(최대 60%까지 감속)
        const ratio = this.staminaLeft / expectedStamina;
        speed *= 0.6 + 0.4 * Math.max(0, Math.min(1, ratio));
      }
    }
    speed += this.slipstreamSpeedBonus;
    speed += this.lastSpurtAccelBonus;
    // --- apply paceSense penalty if any ---
    if (this.paceSensePenalty > 0) {
      speed *= 1 - this.paceSensePenalty;
    }
    speed = this.applyLowStaminaSpeedPenalty(speed);
    speed = this.applyWeightSpeedPenalty(speed);
    speed = this.applyTemperamentVariance(speed);
    return Math.min(speed, this.maxSpeed);
  }

  private getBasePhaseSpeed(phase: RacePhase): number {
    if (phase === RacePhase.Early) {
      return this.baseSpeed * RACE_SIMULATE_VALUES.EARLY_PHASE_SPEED;
    }
    if (phase === RacePhase.Middle) {
      return this.baseSpeed * RACE_SIMULATE_VALUES.MIDDLE_PHASE_SPEED;
    }
    // 라스트스퍼트가 아니면 baseSpeed 그대로
    return this.baseSpeed;
  }

  private getMoveDistanceByGoalSpeed(
    goalSpeed: number,
    isCorner: boolean = false,
    isOvertaking: boolean = false
  ): number {
    const { MAXSPEED_STAT, SPEED_MPS } = RACE_SIMULATE_VALUES;
    const effectiveAcceleration = this.getCurrentAcceleration(
      isCorner,
      isOvertaking
    );
    let nextSpeed: number;
    if (this.currentSpeed < goalSpeed) {
      nextSpeed = this.currentSpeed + effectiveAcceleration;
      if (nextSpeed > goalSpeed) {
        nextSpeed = goalSpeed;
      }
      if (nextSpeed > this.maxSpeed) {
        nextSpeed = this.maxSpeed;
      }
      this.currentSpeed = nextSpeed;
    } else {
      nextSpeed = this.currentSpeed - effectiveAcceleration;
      if (nextSpeed < goalSpeed) {
        nextSpeed = goalSpeed;
      }
      if (nextSpeed < 0) {
        nextSpeed = 0;
      }
      this.currentSpeed = nextSpeed;
    }
    let moveDistance = (this.currentSpeed / MAXSPEED_STAT) * SPEED_MPS;
    // --- nonlinear stamina penalty ---
    const staminaRatio = Math.max(0, this.staminaLeft / this.stamina);
    if (staminaRatio < 0.5) {
      moveDistance *= Math.max(0.1, Math.pow(staminaRatio * 2, 2) / 4); // 0.25x at 25%, 0.01x at 5%
    }
    if (this.staminaLeft <= 0) {
      // At 0 stamina, movement is drastically reduced
      moveDistance *= 0.15; // Only 15% of normal
      this.currentSpeed *= 0.7; // Bleed off speed
    }
    // --- 코너 구간: 코너링 기반 이동량 보정 ---
    if (isCorner) {
      const corneringRatio = this.cornering / 1200;
      // 코너링 600 이하면 -15%~최대 -30%, 1200이면 +10%
      if (corneringRatio < 0.5) {
        moveDistance *= 0.7 + 0.6 * corneringRatio; // 0.4~1.0
      } else {
        moveDistance *= 1 + 0.2 * (corneringRatio - 0.5); // 1~1.1
      }
    }
    if (moveDistance < 0) {
      moveDistance = 0;
    }
    return moveDistance;
  }

  // Helper for stat-driven stamina penalty for overtaking/positioning
  public getStaminaPenaltyFactor(): number {
    // Returns a penalty factor (0.5~1.0) based on current stamina
    const staminaRatio = Math.max(0, this.staminaLeft / this.stamina);
    if (staminaRatio > 0.7) return 1.0;
    if (staminaRatio > 0.4) return 0.8;
    if (staminaRatio > 0.2) return 0.6;
    return 0.4;
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

  static isInCornerSection(distance: number, corner: TrackCorner): boolean {
    return distance >= corner.start && distance < corner.end;
  }

  public isLaneBlocked(horses: RaceHorse[], targetLane: number): boolean {
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      const sameLane = h.lane === targetLane;
      const diff = Math.abs(h.distance - this.distance);
      const blocked =
        sameLane && diff < RACE_SIMULATE_VALUES.CLOSE_POSITION_BLOCK;
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
      const isInner =
        sameLane && diff < RACE_SIMULATE_VALUES.CLOSE_POSITION_INNER;
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
    const {
      SLIPSTREAM_MIN_DIST,
      SLIPSTREAM_MAX_DIST,
      SLIPSTREAM_SPEED_BONUS,
      SLIPSTREAM_ACCEL_BONUS,
    } = RACE_SIMULATE_VALUES;
    const sameLaneAhead = this.getClosestHorseAheadInLane(horses);
    if (!sameLaneAhead) {
      return { speed: 0, accel: 0 };
    }
    const distanceToAhead = sameLaneAhead.distance - this.distance;
    const inSlipstreamZone =
      distanceToAhead >= SLIPSTREAM_MIN_DIST &&
      distanceToAhead <= SLIPSTREAM_MAX_DIST;
    let slipstreamBonus = 0;
    let accelBonus = 0;
    if (inSlipstreamZone) {
      slipstreamBonus = SLIPSTREAM_SPEED_BONUS;
      accelBonus = SLIPSTREAM_ACCEL_BONUS;
    }
    return { speed: slipstreamBonus, accel: accelBonus };
  }

  private isLeading(horses: RaceHorse[]): boolean {
    return horses.every((h) => h === this || this.distance >= h.distance);
  }

  private isInCorner(track: RaceTrack): boolean {
    return track.corners.some(
      (corner) => this.distance >= corner.start && this.distance < corner.end
    );
  }

  private getOvertakeLane(
    horses: RaceHorse[],
    track: RaceTrack
  ): number | null {
    // 1등이면 코너 구간에서만 인코스 진입 허용
    if (this.isLeading(horses)) {
      if (!this.isInCorner(track)) return null;
      const inLane = this.lane - 1;
      if (inLane >= 1 && !this.isLaneBlocked(horses, inLane)) {
        return inLane;
      }
      return null;
    }
    // 기존 추월 로직
    const candidateLanes = [this.lane - 1, this.lane + 1].filter((l) => l >= 1);
    for (const lane of candidateLanes) {
      if (!this.isLaneBlocked(horses, lane)) {
        let blockedAhead = false;
        for (let j = 0; j < horses.length; j++) {
          const h = horses[j];
          if (
            h.lane === lane &&
            h.distance > this.distance &&
            h.distance - this.distance <
              RACE_SIMULATE_VALUES.CLOSE_POSITION_BLOCK
          ) {
            blockedAhead = true;
            break;
          }
        }
        if (!blockedAhead) {
          return lane;
        }
      }
    }
    return null;
  }

  public findUnblockedLaneForSpurt(
    horses: RaceHorse[],
    track: RaceTrack
  ): number | null {
    // 1등이면 코너 구간에서만 인코스 진입 허용
    if (this.isLeading(horses)) {
      if (!this.isInCorner(track)) return null;
      const inLane = this.lane - 1;
      if (inLane >= 1 && !this.isLaneBlocked(horses, inLane)) {
        return inLane;
      }
      return null;
    }
    // 기존 로직
    const candidateLanes = [this.lane - 1, this.lane + 1].filter((l) => l >= 1);
    for (let i = 0; i < candidateLanes.length; i++) {
      const lane = candidateLanes[i];
      if (!this.isLaneBlocked(horses, lane)) {
        let ahead = null;
        for (let j = 0; j < horses.length; j++) {
          const h = horses[j];
          if (h.lane === lane && h.distance > this.distance) {
            ahead = h;
            break;
          }
        }
        if (!ahead) {
          return lane;
        }
      }
    }
    return null;
  }

  /**
   * 라스트스퍼트 및 bad spurt 판정 처리 (RaceSimulator에서 위임)
   */
  public handleSpurtPhase(track: any) {
    if (!this.isSpurting) return;
    const optimalSpurt = RACE_SIMULATE_VALUES.OPTIMAL_SPURT_BASE;
    const paceSense = this.paceSense;
    const spurtError = Math.abs(
      this.distance -
        (track.finishLine -
          optimalSpurt -
          (RACE_SIMULATE_VALUES.PACE_SENSE_BASE - paceSense / 10) *
            RACE_SIMULATE_VALUES.PACE_SENSE_STEP)
    );
    if (spurtError > 600 && !this.hadBadSpurt) {
      this.applyBadSpurtPenalty();
    }
    this.isSpurting = true;
  }

  // Call this when spurt is mistimed
  public applyBadSpurtPenalty() {
    // Penalty scales with how low paceSense is (worse for low stat)
    const penalty = 0.15 + (1 - this.paceSense / 1200) * 0.25; // up to -0.4x
    this.paceSensePenalty = penalty;
    this.hadBadSpurt = true;
  }

  /**
   * 경주 중 상태 갱신 (명확한 정보 구조체로 전달)
   */
  public updateRaceState(params: {
    phase: RacePhase;
    track: RaceTrack;
    horses: RaceHorse[];
  }): void {
    const { phase, track, horses } = params;
    const { lastSpurtAccel, ignoreStaminaPenalty } =
      track.getPhaseEffectInfo(this);
    const { speed, accel } = this.getSlipstreamBonus(horses);
    this.slipstreamSpeedBonus = speed;
    this.slipstreamAccelBonus = accel;
    this.lastSpurtAccelBonus = lastSpurtAccel;
    this.ignoreStaminaPenalty = ignoreStaminaPenalty;
    // 코너 구간 판정
    const isCorner = track.corners.some(
      (corner) => this.distance >= corner.start && this.distance < corner.end
    );
    // 추월 시도 판정: 내 목표 속도가 maxLaneSpeed보다 높으면 추월 시도
    let maxLaneSpeed = this.getMaxSpeedInMyLane(horses, phase, track);
    let myGoalSpeed = this.getPhaseGoalSpeed(phase, track);
    let isOvertaking = false;
    if (myGoalSpeed > maxLaneSpeed) {
      isOvertaking = true;
      let overtakeLane: number | null = null;
      if (phase === RacePhase.Final) {
        overtakeLane = this.findUnblockedLaneForSpurt(horses, track);
      } else {
        overtakeLane = this.getOvertakeLane(horses, track);
      }
      if (overtakeLane) {
        this.lane = overtakeLane;
      } else {
        myGoalSpeed = maxLaneSpeed;
      }
    }
    this.updateForTurnWithGoalSpeed(phase, myGoalSpeed, isCorner, isOvertaking);
  }

  private updateForTurnWithGoalSpeed(
    phase: RacePhase,
    targetSpeed: number,
    isCorner: boolean = false,
    isOvertaking: boolean = false
  ) {
    this.consumeStaminaByPhase(phase);
    const move = this.getMoveDistanceByGoalSpeed(
      targetSpeed,
      isCorner,
      isOvertaking
    );
    this.distance += move;
  }

  public applyLowStaminaSpeedPenalty(speed: number): number {
    const { STAMINA_PENALTY_RATIO, LOW_STAMINA_SPEED } = RACE_SIMULATE_VALUES;
    if (this.ignoreStaminaPenalty) {
      return speed;
    }
    const staminaThreshold = this.stamina * STAMINA_PENALTY_RATIO;
    const isLowStamina = this.staminaLeft < staminaThreshold;
    if (isLowStamina) {
      return speed * LOW_STAMINA_SPEED;
    }
    return speed;
  }

  public applyWeightSpeedPenalty(speed: number): number {
    const { WEIGHT_PENALTY } = RACE_SIMULATE_VALUES;
    const penalty = this.weight * WEIGHT_PENALTY;
    return speed - penalty;
  }

  public applyTemperamentVariance(speed: number): number {
    const { TEMPERAMENT_VARIANCE } = RACE_SIMULATE_VALUES;
    const temperamentVariance = this.temperament * TEMPERAMENT_VARIANCE;
    const variance = this.randomVariance() * temperamentVariance;
    return speed + variance;
  }

  private getMaxSpeedInMyLane(
    horses: RaceHorse[],
    phase: RacePhase,
    track: RaceTrack
  ): number {
    const ahead = this.getClosestHorseAheadInLane(horses);
    if (ahead) {
      const distToAhead = ahead.distance - this.distance;
      if (
        distToAhead > 0 &&
        distToAhead < RACE_SIMULATE_VALUES.CLOSE_POSITION_BLOCK
      ) {
        return ahead.currentSpeed;
      }
    }
    // 앞에 말이 없으면 내 목표 속도와 같게(라인 변경 안 하도록)
    return this.getPhaseGoalSpeed(phase, track);
  }

  /**
   * 포지셔닝 싸움 시도 (내부 상태 직접 변경)
   * horses 인자 제거, Race 객체에서 직접 조회하도록 개선 가능
   */
  public tryPositioningFight(race: {
    raceHorses: RaceHorse[];
    corners: any[];
  }): void {
    const horses = race.raceHorses;
    if (this.lane === 1) return;
    const targetLane = this.lane - 1;
    const blocked = this.isLaneBlocked(horses, targetLane);
    if (!blocked) {
      const myScore =
        this.positioning * this.getStaminaPenaltyFactor() +
        this.randomVariance();
      const inner = this.getInnerHorseInLane(horses, targetLane);
      let innerScore = 0;
      if (inner) {
        innerScore =
          inner.positioning * inner.getStaminaPenaltyFactor() +
          this.randomVariance();
      }
      this.staminaLeft -= 0.2;
      if (!inner || myScore > innerScore) {
        this.lane = targetLane;
      }
    }
  }

  /**
   * 코너 추월 시도 (내부 상태 직접 변경)
   * horses 인자 제거, Race 객체에서 직접 조회하도록 개선 가능
   */
  public tryOvertake(race: { raceHorses: RaceHorse[]; corners: any[] }): void {
    for (const corner of race.corners) {
      const horses = race.raceHorses;
      const inCorner = corner.isInCorner(this.distance);
      if (!inCorner) continue;
      const targetLane = this.lane - 1;
      if (targetLane < 1) continue;
      const blocked = this.isLaneBlocked(horses, targetLane);
      if (blocked) continue;
      this.staminaLeft -= 0.2;
      const staminaPenalty = this.getStaminaPenaltyFactor();
      const myPower =
        this.getCornerOvertakePower(corner.difficulty) * staminaPenalty;
      const inner = this.getInnerHorseInLane(horses, targetLane);
      let innerPower = 0;
      if (inner) {
        innerPower =
          inner.getCornerOvertakePower(corner.difficulty) *
          inner.getStaminaPenaltyFactor();
      }
      if (!inner || myPower > innerPower) {
        this.lane = targetLane;
      }
    }
  }
}
