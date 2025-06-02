import { Horse } from "./horse";
import { RACE_CONST } from "./raceConfig";
import { RacePhase } from "./types";

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

  // --- apply: 상태 변화/패널티/보너스 적용 ---

  /** 구간별 스태미나 소모 */
  applyStaminaChange(phase: RacePhase): void {
    if (phase === RacePhase.Early) {
      this.staminaLeft -= RACE_CONST.EARLY_PHASE_STAMINA;
    } else if (phase === RacePhase.Middle) {
      this.staminaLeft -= RACE_CONST.MIDDLE_PHASE_STAMINA;
    } else {
      if (this.isSpurting && this.staminaLeft > 0) {
        this.staminaLeft -= RACE_CONST.FINAL_PHASE_SPURT_STAMINA;
      } else {
        this.staminaLeft -= RACE_CONST.FINAL_PHASE_STAMINA;
      }
    }
  }

  /** 스태미나 패널티 */
  private applyStaminaPenalty(speed: number): number {
    if (this.ignoreStaminaPenalty) {
      return speed;
    }
    const staminaThreshold = this.stamina * RACE_CONST.STAMINA_PENALTY_RATIO;
    const isLowStamina = this.staminaLeft < staminaThreshold;
    if (isLowStamina) {
      return speed * RACE_CONST.LOW_STAMINA_SPEED;
    }
    return speed;
  }

  /** 체중 패널티 */
  private applyWeightPenalty(speed: number): number {
    const penalty = this.weight * RACE_CONST.WEIGHT_PENALTY;
    return speed - penalty;
  }

  /** 기질 랜덤 변동 */
  private applyRandomVariance(speed: number): number {
    const randomFactor = Math.random() - RACE_CONST.RANDOM_BASE;
    const temperamentVariance =
      this.temperament * RACE_CONST.TEMPERAMENT_VARIANCE;
    const variance = randomFactor * temperamentVariance;
    return speed + variance;
  }

  // --- calc: 계산/판정/이동 ---

  /**
   * 현재 적용 가속력(기본+슬립스트림+라스트스퍼트)을 반환
   */
  calcAcceleration(): number {
    return (
      this.acceleration + this.slipstreamAccelBonus + this.lastSpurtAccelBonus
    );
  }

  /** 구간별 목표 속도 계산 */
  calcTargetSpeed(phase: RacePhase): number {
    let speed = this.basePhaseSpeed(phase);
    speed += this.slipstreamSpeedBonus;
    speed += this.lastSpurtAccelBonus;
    speed = this.applyStaminaPenalty(speed);
    speed = this.applyWeightPenalty(speed);
    speed = this.applyRandomVariance(speed);
    return Math.min(speed, this.maxSpeed);
  }

  /** 페이즈별 기본 속도 */
  private basePhaseSpeed(phase: RacePhase): number {
    if (phase === RacePhase.Early) {
      return this.baseSpeed * RACE_CONST.EARLY_PHASE_SPEED;
    }
    if (phase === RacePhase.Middle) {
      return this.baseSpeed * RACE_CONST.MIDDLE_PHASE_SPEED;
    }
    if (this.isSpurting && this.staminaLeft > 0) {
      return this.baseSpeed + this.burst * RACE_CONST.FINAL_PHASE_SPURT_BONUS;
    }
    return this.baseSpeed;
  }

  /** 가속/감속 및 이동량 계산 */
  calcMove(targetSpeed: number): number {
    // 1. 가속력 계산 (기본 + 슬립스트림 + 라스트스퍼트)
    const effectiveAcceleration = this.calcAcceleration();

    // 2. 가속/감속 상황별 속도 계산
    let nextSpeed: number;
    if (this.currentSpeed < targetSpeed) {
      // 가속
      nextSpeed = this.currentSpeed + effectiveAcceleration;
      if (nextSpeed > targetSpeed) {
        nextSpeed = targetSpeed;
      }
      if (nextSpeed > this.maxSpeed) {
        nextSpeed = this.maxSpeed;
      }
      this.currentSpeed = nextSpeed;
    } else {
      // 감속
      nextSpeed = this.currentSpeed - effectiveAcceleration;
      if (nextSpeed < targetSpeed) {
        nextSpeed = targetSpeed;
      }
      if (nextSpeed < 0) {
        nextSpeed = 0;
      }
      this.currentSpeed = nextSpeed;
    }

    // 3. 이동량 계산 (currentSpeed는 m/s, 단위 변환)
    const minMoveFactor = RACE_CONST.MOVE_FACTOR_MIN;
    const moveFactorRange = RACE_CONST.MOVE_FACTOR_RANGE;
    const randomValue = Math.random();
    const moveFactor = minMoveFactor + randomValue * moveFactorRange;
    let moveDistance = this.currentSpeed * moveFactor * RACE_CONST.UNIT;
    if (moveDistance < 0) {
      moveDistance = 0;
    }
    return moveDistance;
  }

  /**
   * 코너 추월 파워 계산 (코너 난이도 수치에 따라 보정)
   * @param difficulty 코너 난이도 계수(1.0=기본, 1.1=완만, 0.9=가파름 등)
   */
  calcCornerOvertakePower(difficulty: number): number {
    let basePower =
      this.cornering +
      this.positioning +
      this.temperament +
      (Math.random() - RACE_CONST.RANDOM_BASE);
    basePower *= difficulty;
    return basePower;
  }

  /** 한 턴 실행 */
  run(phase: RacePhase) {
    // 1. 목표속도 계산
    const targetSpeed = this.calcTargetSpeed(phase);
    // 2. 스태미나 소모
    this.applyStaminaChange(phase);
    // 3. 가속/이동
    const move = this.calcMove(targetSpeed);
    // 4. 거리 갱신
    this.distance += move;
  }

  // --- 코너/특수효과 ---

  /** 코너 구간 판정 (코너 타입 포함) */
  static isInCorner(
    distance: number,
    corner: { start: number; end: number }
  ): boolean {
    return distance >= corner.start && distance < corner.end;
  }
}
