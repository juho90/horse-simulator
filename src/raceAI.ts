import {
  DirectionalDistance,
  DirectionalDistanceWithSource,
  DistanceSource,
} from "./directionalDistance";
import { DrivingMode } from "./drivingMode";
import { Lane, LaneChange, RacePhase } from "./laneEvaluation";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";
import { RaceStrategyPlan } from "./raceStrategyPlan";

export enum UrgencyLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Emergency = "emergency",
}

export enum AvoidanceDirection {
  Left = "left",
  Right = "right",
  Brake = "brake",
}

export enum CollisionSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
}

export enum ActionType {
  Overtake = "overtake",
  Maintain = "maintain",
  Defend = "defend",
  ChangeLane = "change_lane",
}

export interface AIDirectionalDecision {
  action: ActionType;
  targetLane?: Lane;
  intensity: number;
}

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  laneChange: LaneChange;
  urgencyLevel: UrgencyLevel;
  currentMode: DrivingMode;
}

export interface HorseStateInfo {
  stamina: number;
  maxStamina: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  position: { x: number; y: number };
  direction: number;
  horseId: string;
}

interface CollisionPrediction {
  willCollide: boolean;
  turnsToCollision: number;
  avoidanceDirection: AvoidanceDirection;
  severity: CollisionSeverity;
}

const modeWeights: {
  [key in DrivingMode]: {
    safety: number;
    efficiency: number;
    competition: number;
    energy: number;
  };
} = {
  [DrivingMode.MaintainingPace]: {
    safety: 0.5,
    efficiency: 0.3,
    competition: 0.1,
    energy: 0.1,
  },
  [DrivingMode.Overtaking]: {
    safety: 0.4,
    efficiency: 0.2,
    competition: 0.3,
    energy: 0.1,
  },
  [DrivingMode.Blocked]: {
    safety: 0.7,
    efficiency: 0.2,
    competition: 0.1,
    energy: 0.0,
  },
  [DrivingMode.Positioning]: {
    safety: 0.6,
    efficiency: 0.3,
    competition: 0.1,
    energy: 0.0,
  },
  [DrivingMode.Conserving]: {
    safety: 0.3,
    efficiency: 0.2,
    competition: 0.0,
    energy: 0.5,
  },
  [DrivingMode.LastSpurt]: {
    safety: 0.3,
    efficiency: 0.1,
    competition: 0.6,
    energy: 0.0,
  },
};

export class RaceAI {
  private horse: RaceHorse;
  private raceEnv: RaceEnvironment;
  private raceAnalysis: RaceSituationAnalysis;
  private racePlan: RaceStrategyPlan;
  private currentMode: DrivingMode = DrivingMode.MaintainingPace;
  private aiDirectionalDecision: AIDirectionalDecision | null = null;
  private aiDecision: AIDecision | null = null;
  private adaptiveParameters: {
    riskTolerance: number;
    aggressiveness: number;
    laneChangeCooldown: number;
  };
  private lastDecisionTurn: number = -1;

  constructor(
    horse: RaceHorse,
    raceEnvironment: RaceEnvironment,
    raceAnalysis: RaceSituationAnalysis,
    racePlan: RaceStrategyPlan
  ) {
    this.horse = horse;
    this.raceEnv = raceEnvironment;
    this.raceAnalysis = raceAnalysis;
    this.racePlan = racePlan;
    this.currentMode = DrivingMode.MaintainingPace;
    this.adaptiveParameters = {
      riskTolerance: 0.3,
      aggressiveness: 0.5,
      laneChangeCooldown: 3,
    };
    this.lastDecisionTurn = -1;
  }

  update(turn: number): AIDecision {
    const directionalDecision = this.makeDirectionalDecision(turn);
    this.aiDirectionalDecision = directionalDecision;
    const decision = this.makeDecision(directionalDecision);
    this.aiDecision = decision;
    return decision;
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDirectionalDecision(): AIDirectionalDecision | null {
    return this.aiDirectionalDecision;
  }

  getAIDecision(): AIDecision | null {
    return this.aiDecision;
  }

  private makeDecision(directionalDecision: AIDirectionalDecision): AIDecision {
    const collision = this.predictCollision();
    const urgency = this.evaluateUrgency(collision);
    const mode = this.determineDrivingMode(collision);
    const targetSpeed = this.calculateOptimalSpeed();
    const targetDirection = this.calculateOptimalDirection(
      collision,
      directionalDecision
    );
    const targetAccel = this.calculateTargetAcceleration(targetSpeed);
    const laneChange = this.decideLaneChange(collision, directionalDecision);
    const decision: AIDecision = {
      targetSpeed,
      targetDirection,
      targetAccel,
      laneChange,
      urgencyLevel: urgency,
      currentMode: mode,
    };
    this.currentMode = mode;
    return decision;
  }

  private evaluateUrgency(collision: CollisionPrediction): UrgencyLevel {
    if (collision.willCollide && collision.turnsToCollision < 2) {
      return UrgencyLevel.Emergency;
    }
    if (collision.willCollide && collision.turnsToCollision < 4) {
      return UrgencyLevel.High;
    }
    const horseState = this.getHorseState();
    if (horseState.stamina < 0.2) {
      return UrgencyLevel.Medium;
    }
    return UrgencyLevel.Low;
  }

  private determineDrivingMode(collision: CollisionPrediction): DrivingMode {
    if (this.isEmergencyAvoidanceNeeded(collision)) {
      return DrivingMode.Blocked;
    }
    const horseState = this.getHorseState();
    if (this.raceAnalysis.racePhase === RacePhase.Final) {
      return DrivingMode.LastSpurt;
    }
    if (horseState.stamina < 0.3 && this.raceAnalysis.racePhase !== "late") {
      return DrivingMode.Conserving;
    }
    if (
      this.raceAnalysis.opportunities?.canOvertake &&
      (this.raceAnalysis.racePhase === RacePhase.Late ||
        this.raceAnalysis.racePhase === RacePhase.Middle)
    ) {
      return DrivingMode.Overtaking;
    }
    if (this.raceAnalysis.drivingMode !== DrivingMode.MaintainingPace) {
      return DrivingMode.Positioning;
    }
    return DrivingMode.MaintainingPace;
  }

  private calculateOptimalSpeed(): number {
    const horseState = this.getHorseState();
    const weights = modeWeights[this.currentMode];
    let baseSpeed = horseState.maxSpeed * 0.8;

    if (this.currentMode === DrivingMode.LastSpurt) {
      baseSpeed = horseState.maxSpeed;
    } else if (this.currentMode === DrivingMode.Conserving) {
      baseSpeed = horseState.maxSpeed * 0.6;
    } else if (this.currentMode === DrivingMode.Overtaking) {
      baseSpeed = horseState.maxSpeed * 0.9;
    }

    // 🚧 가드레일 회피를 위한 속도 조정
    const directionalDistance = this.raceAnalysis.dirDistanceWithSource;
    const guardrailSpeedReduction =
      this.calculateGuardrailSpeedReduction(directionalDistance);

    const staminaFactor = Math.max(
      0.3,
      horseState.stamina / horseState.maxStamina
    );

    // 가드레일 회피 속도 감소 적용
    const finalSpeed =
      baseSpeed * staminaFactor * (1 - guardrailSpeedReduction);

    return Math.max(horseState.maxSpeed * 0.2, finalSpeed); // 최소 속도 보장
  }

  /**
   * 🚧 가드레일 거리에 따른 속도 감소 계산
   */
  private calculateGuardrailSpeedReduction(
    directionalDistance: DirectionalDistanceWithSource
  ): number {
    const EMERGENCY_DISTANCE = 8;
    const WARNING_DISTANCE = 15;

    let maxReduction = 0;

    // 좌측 가드레일 체크
    if (directionalDistance.left.distance < EMERGENCY_DISTANCE) {
      maxReduction = Math.max(maxReduction, 0.5); // 50% 속도 감소
    } else if (directionalDistance.left.distance < WARNING_DISTANCE) {
      const reductionRatio =
        (WARNING_DISTANCE - directionalDistance.left.distance) /
        WARNING_DISTANCE;
      maxReduction = Math.max(maxReduction, reductionRatio * 0.3); // 최대 30% 감소
    }

    // 우측 가드레일 체크
    if (directionalDistance.right.distance < EMERGENCY_DISTANCE) {
      maxReduction = Math.max(maxReduction, 0.5); // 50% 속도 감소
    } else if (directionalDistance.right.distance < WARNING_DISTANCE) {
      const reductionRatio =
        (WARNING_DISTANCE - directionalDistance.right.distance) /
        WARNING_DISTANCE;
      maxReduction = Math.max(maxReduction, reductionRatio * 0.3); // 최대 30% 감소
    }

    return maxReduction;
  }

  private calculateOptimalDirection(
    collision: CollisionPrediction,
    directionalDecision: AIDirectionalDecision
  ): number {
    const currentHeading = this.horse.raceHeading;
    let targetHeading = this.racePlan.targetDirection;
    let directionAdjustment = 0;

    // 🚧 출처 정보 포함 거리 데이터 활용한 스마트 회피 시스템
    const distanceWithSource = this.raceAnalysis.dirDistanceWithSource;
    const smartAvoidance = this.calculateSmartAvoidance(distanceWithSource);
    directionAdjustment += smartAvoidance.adjustment;

    // 긴급 상황이면 다른 로직 무시하고 즉시 반환
    if (smartAvoidance.isEmergency) {
      targetHeading = currentHeading + smartAvoidance.adjustment;
      const maxEmergencyAdjustment = 1.5; // 긴급시 더 큰 조정 허용
      return Math.max(
        currentHeading - maxEmergencyAdjustment,
        Math.min(currentHeading + maxEmergencyAdjustment, targetHeading)
      );
    }

    // 전략적 결정 적용 (스마트 회피 후)
    if (directionalDecision) {
      if (directionalDecision.action === ActionType.ChangeLane) {
        if (directionalDecision.targetLane === Lane.Inner) {
          directionAdjustment += -0.3 * directionalDecision.intensity;
        } else if (directionalDecision.targetLane === Lane.Outer) {
          directionAdjustment += 0.3 * directionalDecision.intensity;
        }
      } else if (directionalDecision.action === ActionType.Overtake) {
        directionAdjustment += 0.2 * directionalDecision.intensity;
      }
    }

    // 충돌 회피 적용 (스마트 회피가 우선)
    if (
      this.currentMode === DrivingMode.Blocked &&
      !smartAvoidance.isEmergency
    ) {
      if (collision.avoidanceDirection === AvoidanceDirection.Left) {
        directionAdjustment += -0.4;
      } else if (collision.avoidanceDirection === AvoidanceDirection.Right) {
        directionAdjustment += 0.4;
      }
    }

    targetHeading = targetHeading + directionAdjustment;
    const maxAdjustment = smartAvoidance.allowLargeAdjustment ? 1.0 : 0.5;
    targetHeading = Math.max(
      currentHeading - maxAdjustment,
      Math.min(currentHeading + maxAdjustment, targetHeading)
    );
    return targetHeading;
  }

  /**
   * 🚧 출처 정보 기반 스마트 회피 계산
   */
  private calculateSmartAvoidance(
    distanceWithSource: DirectionalDistanceWithSource
  ): {
    adjustment: number;
    isEmergency: boolean;
    allowLargeAdjustment: boolean;
    recommendedDirection: "left" | "right" | "straight";
    reason: string;
  } {
    const SAFE_DISTANCE = 25;
    const WARNING_DISTANCE = 15;
    const EMERGENCY_DISTANCE = 8;

    const speed = this.horse.speed;
    const dynamicSafeDistance = SAFE_DISTANCE + speed * 0.3;
    const dynamicWarningDistance = WARNING_DISTANCE + speed * 0.2;
    const dynamicEmergencyDistance = EMERGENCY_DISTANCE + speed * 0.1;

    let adjustment = 0;
    let isEmergency = false;
    let allowLargeAdjustment = false;
    let recommendedDirection: "left" | "right" | "straight" = "straight";
    let reason = "";

    // 각 방향별 위험도 분석
    const leftAnalysis = this.analyzeDirectionRisk(
      distanceWithSource.left,
      dynamicSafeDistance,
      dynamicWarningDistance,
      dynamicEmergencyDistance
    );
    const rightAnalysis = this.analyzeDirectionRisk(
      distanceWithSource.right,
      dynamicSafeDistance,
      dynamicWarningDistance,
      dynamicEmergencyDistance
    );
    const frontAnalysis = this.analyzeDirectionRisk(
      distanceWithSource.front,
      dynamicSafeDistance,
      dynamicWarningDistance,
      dynamicEmergencyDistance
    );

    // 좌측 위험 처리
    if (leftAnalysis.riskLevel > 0) {
      const avoidanceStrength = this.calculateAvoidanceStrength(leftAnalysis);
      adjustment += avoidanceStrength; // 우측으로 회피

      if (leftAnalysis.riskLevel >= 3) {
        isEmergency = true;
        allowLargeAdjustment = true;
        recommendedDirection = "right";
        reason = `좌측 ${
          leftAnalysis.source
        } 긴급 회피 (${leftAnalysis.distance.toFixed(1)}m)`;
      } else if (leftAnalysis.riskLevel >= 2) {
        allowLargeAdjustment = true;
        recommendedDirection = "right";
        reason = `좌측 ${
          leftAnalysis.source
        } 경고 회피 (${leftAnalysis.distance.toFixed(1)}m)`;
      } else {
        recommendedDirection = "right";
        reason = `좌측 ${
          leftAnalysis.source
        } 일반 회피 (${leftAnalysis.distance.toFixed(1)}m)`;
      }
    }

    // 우측 위험 처리
    if (rightAnalysis.riskLevel > 0) {
      const avoidanceStrength = this.calculateAvoidanceStrength(rightAnalysis);
      adjustment -= avoidanceStrength; // 좌측으로 회피

      if (rightAnalysis.riskLevel >= 3) {
        isEmergency = true;
        allowLargeAdjustment = true;
        recommendedDirection = "left";
        reason = `우측 ${
          rightAnalysis.source
        } 긴급 회피 (${rightAnalysis.distance.toFixed(1)}m)`;
      } else if (rightAnalysis.riskLevel >= 2) {
        allowLargeAdjustment = true;
        recommendedDirection = "left";
        reason = `우측 ${
          rightAnalysis.source
        } 경고 회피 (${rightAnalysis.distance.toFixed(1)}m)`;
      } else {
        recommendedDirection = "left";
        reason = `우측 ${
          rightAnalysis.source
        } 일반 회피 (${rightAnalysis.distance.toFixed(1)}m)`;
      }
    }

    // 양쪽 모두 위험한 경우 - 더 안전한 쪽으로 회피
    if (leftAnalysis.riskLevel > 0 && rightAnalysis.riskLevel > 0) {
      if (leftAnalysis.distance > rightAnalysis.distance) {
        adjustment = -Math.abs(adjustment); // 좌측으로
        recommendedDirection = "left";
        reason = `양쪽 위험, 좌측이 더 안전 (L:${leftAnalysis.distance.toFixed(
          1
        )}m > R:${rightAnalysis.distance.toFixed(1)}m)`;
      } else {
        adjustment = Math.abs(adjustment); // 우측으로
        recommendedDirection = "right";
        reason = `양쪽 위험, 우측이 더 안전 (R:${rightAnalysis.distance.toFixed(
          1
        )}m > L:${leftAnalysis.distance.toFixed(1)}m)`;
      }
    }

    // 전방 위험 처리 (감속 필요)
    if (frontAnalysis.riskLevel >= 3) {
      isEmergency = true;
      this.applyEmergencySpeedReduction(0.5);
      reason += ` + 전방 ${frontAnalysis.source} 긴급 감속`;
    } else if (frontAnalysis.riskLevel >= 2) {
      this.applyEmergencySpeedReduction(0.3);
      reason += ` + 전방 ${frontAnalysis.source} 경고 감속`;
    }

    return {
      adjustment,
      isEmergency,
      allowLargeAdjustment,
      recommendedDirection,
      reason,
    };
  }

  /**
   * 방향별 위험도 분석
   */
  private analyzeDirectionRisk(
    distanceValue: { distance: number; source: DistanceSource },
    safeDistance: number,
    warningDistance: number,
    emergencyDistance: number
  ): {
    riskLevel: number; // 0: 안전, 1: 주의, 2: 경고, 3: 긴급
    distance: number;
    source: string;
    urgency: number;
  } {
    const { distance, source } = distanceValue;

    let riskLevel = 0;
    let urgency = 0;

    if (distance < emergencyDistance) {
      riskLevel = 3;
      urgency = 1.0;
    } else if (distance < warningDistance) {
      riskLevel = 2;
      urgency = 0.7;
    } else if (distance < safeDistance) {
      riskLevel = 1;
      urgency = 0.4;
    }

    return {
      riskLevel,
      distance,
      source: source.toString(),
      urgency,
    };
  }

  /**
   * 출처별 회피 강도 계산
   */
  private calculateAvoidanceStrength(analysis: {
    riskLevel: number;
    distance: number;
    source: string;
    urgency: number;
  }): number {
    let baseStrength = 0;

    // 위험도별 기본 강도
    switch (analysis.riskLevel) {
      case 3:
        baseStrength = 2.0;
        break; // 긴급
      case 2:
        baseStrength = 1.2;
        break; // 경고
      case 1:
        baseStrength = 0.8;
        break; // 주의
      default:
        baseStrength = 0;
        break;
    }

    // 출처별 강도 조정
    let sourceMultiplier = 1.0;
    switch (analysis.source) {
      case "wall":
        sourceMultiplier = 1.5; // 벽/가드레일은 더 적극적으로 회피
        break;
      case "horse":
        sourceMultiplier = 1.2; // 다른 말은 중간 정도 회피
        break;
      case "speed":
        sourceMultiplier = 0.8; // 속도 기반 안전거리는 약간 완화
        break;
      case "corner":
        sourceMultiplier = 1.3; // 코너는 적극적으로 회피
        break;
      default:
        sourceMultiplier = 1.0;
        break;
    }

    return baseStrength * sourceMultiplier * analysis.urgency;
  }

  /**
   * 🚧 거리 기반 가드레일 회피 계산 (기존 호환성 유지)
   */
  private calculateGuardrailAvoidance(
    directionalDistance: DirectionalDistance
  ): {
    adjustment: number;
    isEmergency: boolean;
    allowLargeAdjustment: boolean;
    speedReduction?: number;
  } {
    const SAFE_DISTANCE = 25; // 안전 거리 (미터)
    const WARNING_DISTANCE = 15; // 경고 거리 (미터)
    const EMERGENCY_DISTANCE = 8; // 긴급 회피 거리 (미터)

    // 속도를 고려한 동적 안전 거리
    const speed = this.horse.speed;
    const dynamicSafeDistance = SAFE_DISTANCE + speed * 0.3;
    const dynamicWarningDistance = WARNING_DISTANCE + speed * 0.2;
    const dynamicEmergencyDistance = EMERGENCY_DISTANCE + speed * 0.1;

    let adjustment = 0;
    let isEmergency = false;
    let allowLargeAdjustment = false;
    let speedReduction = 0;

    // 출처 정보 포함 거리 데이터 사용 (가능한 경우)
    const distanceWithSource = this.raceAnalysis.dirDistanceWithSource;

    // 좌측 가드레일 회피 (우측으로 조향)
    if (directionalDistance.leftDistance < dynamicSafeDistance) {
      const leftInfo = distanceWithSource
        ? {
            distance: distanceWithSource.left.distance,
            source: distanceWithSource.left.source,
          }
        : null;

      // 출처별 회피 강도 조정
      let avoidanceMultiplier = 1.0;
      if (leftInfo) {
        switch (leftInfo.source) {
          case DistanceSource.Wall:
            avoidanceMultiplier = 1.5; // 벽/가드레일은 더 적극적으로 회피
            break;
          case DistanceSource.Horse:
            avoidanceMultiplier = 1.2; // 다른 말은 중간 정도 회피
            break;
          case DistanceSource.Speed:
            avoidanceMultiplier = 0.8; // 속도 기반 안전거리는 약간 완화
            break;
          case DistanceSource.Corner:
            avoidanceMultiplier = 1.3; // 코너는 적극적으로 회피
            break;
        }
      }

      const leftUrgency =
        Math.max(
          0,
          (dynamicSafeDistance - directionalDistance.leftDistance) /
            dynamicSafeDistance
        ) * avoidanceMultiplier;

      if (directionalDistance.leftDistance < dynamicEmergencyDistance) {
        // 긴급 상황: 강력한 회피
        adjustment += 2.0 * leftUrgency;
        isEmergency = true;
        allowLargeAdjustment = true;
        speedReduction = 0.4; // 속도 40% 감소
      } else if (directionalDistance.leftDistance < dynamicWarningDistance) {
        // 경고 상황: 강한 회피
        adjustment += 1.2 * leftUrgency;
        allowLargeAdjustment = true;
        speedReduction = 0.2; // 속도 20% 감소
      } else {
        // 안전 마진 침범: 일반 회피
        adjustment += 0.8 * leftUrgency;
      }
    }

    // 우측 가드레일 회피 (좌측으로 조향)
    if (directionalDistance.rightDistance < dynamicSafeDistance) {
      const rightUrgency = Math.max(
        0,
        (dynamicSafeDistance - directionalDistance.rightDistance) /
          dynamicSafeDistance
      );

      if (directionalDistance.rightDistance < dynamicEmergencyDistance) {
        // 긴급 상황: 강력한 회피
        adjustment -= 2.0 * rightUrgency;
        isEmergency = true;
        allowLargeAdjustment = true;
        speedReduction = Math.max(speedReduction, 0.4); // 속도 40% 감소
      } else if (directionalDistance.rightDistance < dynamicWarningDistance) {
        // 경고 상황: 강한 회피
        adjustment -= 1.2 * rightUrgency;
        allowLargeAdjustment = true;
        speedReduction = Math.max(speedReduction, 0.2); // 속도 20% 감소
      } else {
        // 안전 마진 침범: 일반 회피
        adjustment -= 0.8 * rightUrgency;
      }
    }

    // 속도 조정 적용
    if (speedReduction > 0) {
      this.applyEmergencySpeedReduction(speedReduction);
    }

    return {
      adjustment,
      isEmergency,
      allowLargeAdjustment,
      speedReduction,
    };
  }

  /**
   * 긴급 속도 감소 적용
   */
  private applyEmergencySpeedReduction(reductionRatio: number): void {
    // 현재 속도를 즉시 감소 (실제 적용은 calculateOptimalSpeed에서)
    // 여기서는 플래그만 설정하고 실제 적용은 다른 메서드에서 처리
  }

  private calculateTargetAcceleration(targetSpeed: number): number {
    const currentSpeed = this.horse.speed;
    const speedDiff = targetSpeed - currentSpeed;
    return Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, speedDiff * 0.1)
    );
  }

  private decideLaneChange(
    collision: CollisionPrediction,
    directionalDecision: AIDirectionalDecision
  ): LaneChange {
    if (directionalDecision.action === ActionType.ChangeLane) {
      if (directionalDecision.targetLane === Lane.Inner) {
        return LaneChange.Inner;
      } else if (directionalDecision.targetLane === Lane.Outer) {
        return LaneChange.Outer;
      }
    }
    if (this.currentMode === DrivingMode.Blocked) {
      if (collision.avoidanceDirection === AvoidanceDirection.Left) {
        return LaneChange.Inner;
      } else if (collision.avoidanceDirection === AvoidanceDirection.Right) {
        return LaneChange.Outer;
      }
    }
    if (this.currentMode === DrivingMode.Overtaking) {
      return LaneChange.Outer;
    }
    return LaneChange.Stay;
  }

  private predictCollision(): CollisionPrediction {
    const nearbyHorses = this.raceEnv.nearbyHorses;
    const horses = [
      nearbyHorses.front,
      nearbyHorses.left,
      nearbyHorses.right,
    ] as RaceHorse[];
    for (const other of horses) {
      if (!other) {
        continue;
      }
      const distance = Math.sqrt(
        Math.pow(other.x - this.horse.x, 2) +
          Math.pow(other.y - this.horse.y, 2)
      );
      if (distance < 30 && distance > 0) {
        const relativeSpeed = this.horse.speed - other.speed;
        const turnsToCollision =
          Math.max(relativeSpeed, 1) > 0
            ? Math.ceil(distance / Math.max(relativeSpeed, 1))
            : Infinity;
        if (turnsToCollision < 6) {
          return {
            willCollide: true,
            turnsToCollision,
            avoidanceDirection:
              other.x > this.horse.x
                ? AvoidanceDirection.Left
                : AvoidanceDirection.Right,
            severity:
              turnsToCollision < 2
                ? CollisionSeverity.High
                : CollisionSeverity.Medium,
          };
        }
      }
    }
    return {
      willCollide: false,
      turnsToCollision: Infinity,
      avoidanceDirection: AvoidanceDirection.Brake,
      severity: CollisionSeverity.Low,
    };
  }

  private isEmergencyAvoidanceNeeded(collision: CollisionPrediction): boolean {
    return collision.willCollide && collision.turnsToCollision < 3;
  }

  private getHorseState(): HorseStateInfo {
    return {
      stamina: this.horse.stamina,
      maxStamina: this.horse.maxStamina,
      speed: this.horse.speed,
      maxSpeed: this.horse.maxSpeed,
      acceleration: this.horse.accel,
      position: { x: this.horse.x, y: this.horse.y },
      direction: this.horse.raceHeading,
      horseId: this.horse.horseId.toString(),
    };
  }

  makeDirectionalDecision(turn: number): AIDirectionalDecision {
    if (
      turn - this.lastDecisionTurn <
      this.adaptiveParameters.laneChangeCooldown
    ) {
      return {
        action: ActionType.Maintain,
        intensity: 0.5,
      };
    }
    this.racePlan.updateLaneEvaluations();
    const directionalRisk = this.convertDistanceWithSourceToDirectional(
      this.raceAnalysis.dirDistanceWithSource
    );
    if (this.shouldAvoidDanger(directionalRisk)) {
      this.lastDecisionTurn = turn;
      return this.makeSafetyDecision(directionalRisk);
    }
    if (this.shouldChangeLane()) {
      this.lastDecisionTurn = turn;
      return this.makeLaneChangeDecision();
    }
    if (this.shouldOvertake()) {
      this.lastDecisionTurn = turn;
      return this.makeOvertakeDecision();
    }
    if (this.shouldDefend()) {
      this.lastDecisionTurn = turn;
      return this.makeDefendDecision();
    }
    return {
      action: ActionType.Maintain,
      intensity: this.calculateMaintainIntensity(),
    };
  }

  private shouldAvoidDanger(risk: DirectionalDistance): boolean {
    const totalRisk =
      risk.frontDistance +
      risk.leftDistance +
      risk.rightDistance +
      risk.frontLeftDistance +
      risk.frontRightDistance;
    // 거리 기반이므로 총 거리가 안전 임계값(100m) 이하면 위험으로 판단
    return totalRisk < 100 || risk.minDistance < 20;
  }

  private makeSafetyDecision(risk: DirectionalDistance): AIDirectionalDecision {
    const currentLane = this.raceEnv.trackInfo.currentLane;
    const DANGER_DISTANCE = 15; // 위험 거리 (미터)
    const SAFE_DISTANCE = 30; // 안전 거리 (미터)

    // 좌측이 매우 위험한 경우 (거리 기반)
    if (risk.leftDistance < DANGER_DISTANCE && currentLane !== Lane.Outer) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Outer,
        intensity: 0.9,
      };
    }

    // 우측이 매우 위험한 경우 (거리 기반)
    if (risk.rightDistance < DANGER_DISTANCE && currentLane !== Lane.Inner) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Inner,
        intensity: 0.9,
      };
    }

    // 좌측이 더 안전한 경우
    if (
      risk.leftDistance > risk.rightDistance &&
      risk.leftDistance > SAFE_DISTANCE &&
      currentLane !== Lane.Inner
    ) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Inner,
        intensity: 0.8,
      };
    }

    // 우측이 더 안전한 경우
    if (
      risk.rightDistance > risk.leftDistance &&
      risk.rightDistance > SAFE_DISTANCE &&
      currentLane !== Lane.Outer
    ) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Outer,
        intensity: 0.8,
      };
    }

    return {
      action: ActionType.Defend,
      intensity: 0.9,
    };
  }

  private shouldChangeLane(): boolean {
    return this.racePlan.shouldChangeLane();
  }

  private makeLaneChangeDecision(): AIDirectionalDecision {
    const recommendation = this.racePlan.getLaneChangeRecommendation();
    const intensity = this.calculateLaneChangeIntensity(recommendation.urgency);
    return {
      action: ActionType.ChangeLane,
      targetLane: recommendation.targetLane,
      intensity,
    };
  }

  private calculateLaneChangeIntensity(urgency: UrgencyLevel): number {
    const baseIntensity = {
      [UrgencyLevel.Low]: 0.4,
      [UrgencyLevel.Medium]: 0.6,
      [UrgencyLevel.High]: 0.8,
      [UrgencyLevel.Emergency]: 0.9,
    }[urgency];
    const raceProgress = this.raceEnv.selfStatus.raceProgress;
    const progressMultiplier = raceProgress > 0.8 ? 1.2 : 1.0;
    return Math.min(
      1.0,
      baseIntensity *
        progressMultiplier *
        this.adaptiveParameters.aggressiveness
    );
  }

  private shouldOvertake(): boolean {
    const opportunities = this.raceAnalysis.opportunities;
    const directionalDistance = this.convertDistanceWithSourceToDirectional(
      this.raceAnalysis.dirDistanceWithSource
    );
    if (!opportunities.canOvertake) {
      return false;
    }
    const safeDistanceThreshold = 30; // 추월을 위한 최소 안전 거리 (미터)
    const safetyCheck =
      directionalDistance.frontDistance > safeDistanceThreshold &&
      directionalDistance.frontLeftDistance > safeDistanceThreshold &&
      directionalDistance.frontRightDistance > safeDistanceThreshold;
    const staminaCheck =
      this.raceEnv.selfStatus.stamina > this.horse.maxStamina * 0.2;
    const rankMotivation = this.raceEnv.selfStatus.currentRank > 3;
    return (
      safetyCheck &&
      staminaCheck &&
      (rankMotivation || this.adaptiveParameters.aggressiveness > 0.7)
    );
  }

  private makeOvertakeDecision(): AIDirectionalDecision {
    const envData = this.raceEnv;
    const rank = envData.selfStatus.currentRank;
    const raceProgress = envData.selfStatus.raceProgress;
    let intensity = 0.6;
    if (rank > 5) {
      intensity += 0.2;
    }
    if (raceProgress > 0.7) {
      intensity += 0.15;
    }
    intensity *= this.adaptiveParameters.aggressiveness;
    intensity = Math.min(0.95, intensity);
    return {
      action: ActionType.Overtake,
      intensity,
    };
  }

  private shouldDefend(): boolean {
    const envData = this.raceEnv;
    const rank = envData.selfStatus.currentRank;
    const raceProgress = envData.selfStatus.raceProgress;
    if (rank > 3) {
      return false;
    }
    const nearbyHorses = envData.nearbyHorses;
    const hasNearbyThreat = Object.values(nearbyHorses.distances).some(
      (distance) => distance < 30
    );
    return hasNearbyThreat && raceProgress > 0.6;
  }

  private makeDefendDecision(): AIDirectionalDecision {
    const envData = this.raceEnv;
    const rank = envData.selfStatus.currentRank;
    let intensity = 0.7;
    if (rank <= 2) {
      intensity += 0.2;
    }
    return {
      action: ActionType.Defend,
      intensity,
    };
  }

  private calculateMaintainIntensity(): number {
    const envData = this.raceEnv;
    const stamina = envData.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    const raceProgress = envData.selfStatus.raceProgress;
    let intensity = 0.5;
    if (staminaRatio < 0.3) {
      intensity = 0.3;
    } else if (staminaRatio > 0.8 && raceProgress < 0.7) {
      intensity = 0.7;
    }
    if (raceProgress > 0.8) {
      intensity = Math.min(0.9, intensity + 0.2);
    }
    return intensity;
  }

  adaptToPerformance(collisionRate: number, distanceEfficiency: number): void {
    if (collisionRate > 0.001) {
      this.adaptiveParameters.riskTolerance = Math.max(
        0.1,
        this.adaptiveParameters.riskTolerance - 0.05
      );
      this.adaptiveParameters.aggressiveness = Math.max(
        0.2,
        this.adaptiveParameters.aggressiveness - 0.1
      );
      this.adaptiveParameters.laneChangeCooldown = Math.min(
        8,
        this.adaptiveParameters.laneChangeCooldown + 1
      );
    } else if (collisionRate < 0.0003) {
      this.adaptiveParameters.riskTolerance = Math.min(
        0.6,
        this.adaptiveParameters.riskTolerance + 0.02
      );
      this.adaptiveParameters.aggressiveness = Math.min(
        0.9,
        this.adaptiveParameters.aggressiveness + 0.05
      );
      this.adaptiveParameters.laneChangeCooldown = Math.max(
        2,
        this.adaptiveParameters.laneChangeCooldown - 0.5
      );
    }
    if (distanceEfficiency < 0.95) {
      this.adaptiveParameters.aggressiveness = Math.max(
        0.3,
        this.adaptiveParameters.aggressiveness - 0.05
      );
    } else if (distanceEfficiency > 0.98) {
      this.adaptiveParameters.aggressiveness = Math.min(
        0.8,
        this.adaptiveParameters.aggressiveness + 0.03
      );
    }
  }

  /**
   * DirectionalDistanceWithSource를 DirectionalDistance로 변환
   */
  private convertDistanceWithSourceToDirectional(
    distanceWithSource: DirectionalDistanceWithSource
  ): DirectionalDistance {
    return {
      frontDistance: distanceWithSource.front.distance,
      leftDistance: distanceWithSource.left.distance,
      rightDistance: distanceWithSource.right.distance,
      frontLeftDistance: distanceWithSource.frontLeft.distance,
      frontRightDistance: distanceWithSource.frontRight.distance,
      minDistance: distanceWithSource.minValue.distance,
    };
  }

  getAdaptiveParameters() {
    return { ...this.adaptiveParameters };
  }
}
