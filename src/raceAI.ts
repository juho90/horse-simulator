import { DirectionalRisk } from "./directionalRisk";
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
    const staminaFactor = Math.max(
      0.3,
      horseState.stamina / horseState.maxStamina
    );
    return baseSpeed * staminaFactor;
  }

  private calculateOptimalDirection(
    collision: CollisionPrediction,
    directionalDecision: AIDirectionalDecision
  ): number {
    const currentHeading = this.horse.raceHeading;
    let targetHeading = this.racePlan.targetDirection;
    let directionAdjustment = 0;

    // 전략적 결정 적용
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

    // 충돌 회피 적용
    if (this.currentMode === DrivingMode.Blocked) {
      if (collision.avoidanceDirection === AvoidanceDirection.Left) {
        directionAdjustment += -0.4;
      } else if (collision.avoidanceDirection === AvoidanceDirection.Right) {
        directionAdjustment += 0.4;
      }
    }

    // DirectionalRisk 기반 조정 - 가드레일 위험 포함
    const directionalRisk = this.raceAnalysis.directionalRisk;

    // 좌측 위험이 높으면 우측으로, 우측 위험이 높으면 좌측으로
    if (directionalRisk.left > 0.5) {
      directionAdjustment += 0.4 * directionalRisk.left; // 우측으로
    }
    if (directionalRisk.right > 0.5) {
      directionAdjustment -= 0.4 * directionalRisk.right; // 좌측으로
    }

    // 기존 로직 유지
    if (directionalRisk.left > 0.7 && directionalRisk.right < 0.3) {
      directionAdjustment += 0.15;
    } else if (directionalRisk.right > 0.7 && directionalRisk.left < 0.3) {
      directionAdjustment -= 0.15;
    }

    targetHeading = targetHeading + directionAdjustment;
    const maxAdjustment = 0.5;
    targetHeading = Math.max(
      currentHeading - maxAdjustment,
      Math.min(currentHeading + maxAdjustment, targetHeading)
    );
    return targetHeading;
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
    const directionalRisk = this.raceAnalysis.directionalRisk;
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

  private shouldAvoidDanger(risk: DirectionalRisk): boolean {
    const totalRisk =
      risk.front + risk.left + risk.right + risk.frontLeft + risk.frontRight;
    return totalRisk > this.adaptiveParameters.riskTolerance * 2;
  }

  private makeSafetyDecision(risk: DirectionalRisk): AIDirectionalDecision {
    const currentLane = this.raceEnv.trackInfo.currentLane;
    if (risk.left > 0.8 && currentLane !== Lane.Outer) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Outer,
        intensity: 0.9,
      };
    }
    if (risk.right > 0.8 && currentLane !== Lane.Inner) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Inner,
        intensity: 0.9,
      };
    }
    if (
      risk.left < risk.right &&
      risk.left < 0.3 &&
      currentLane !== Lane.Inner
    ) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Inner,
        intensity: 0.8,
      };
    }
    if (
      risk.right < risk.left &&
      risk.right < 0.3 &&
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
    const directionalRisk = this.raceAnalysis.directionalRisk;
    if (!opportunities.canOvertake) {
      return false;
    }
    const riskThreshold = this.adaptiveParameters.riskTolerance;
    const safetyCheck =
      directionalRisk.front < riskThreshold &&
      directionalRisk.frontLeft < riskThreshold &&
      directionalRisk.frontRight < riskThreshold;
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

  getAdaptiveParameters() {
    return { ...this.adaptiveParameters };
  }
}
