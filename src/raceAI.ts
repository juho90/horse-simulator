import { DirectionalRisk } from "./directionalRisk";
import { DrivingMode } from "./drivingMode";
import { Lane, LaneChange } from "./laneEvaluation";
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

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  laneChange: LaneChange;
  urgencyLevel: UrgencyLevel;
  currentMode: DrivingMode;
  reasoning: string;
}

export interface HorseStateInfo {
  stamina: number;
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
  private environment: RaceEnvironment;
  private situationAnalysis: RaceSituationAnalysis;
  private strategyPlan: RaceStrategyPlan;
  private currentMode: DrivingMode = DrivingMode.MaintainingPace;
  private aiDecision: AIDecision | null = null;
  private decisionHistory: AIDecision[];
  private lastDecisionTime: number;
  private modeTransitionCooldown: number = 0;
  private adaptiveParameters: {
    riskTolerance: number;
    aggressiveness: number;
    laneChangeCooldown: number;
  };
  private lastDecisionTurn: number = -1;

  constructor(
    horse: RaceHorse,
    environment: RaceEnvironment,
    situationAnalysis: RaceSituationAnalysis,
    strategyPlan: RaceStrategyPlan
  ) {
    this.horse = horse;
    this.environment = environment;
    this.situationAnalysis = situationAnalysis;
    this.strategyPlan = strategyPlan;
    this.currentMode = DrivingMode.MaintainingPace;
    this.modeTransitionCooldown = 0;

    this.adaptiveParameters = {
      riskTolerance: 0.3,
      aggressiveness: 0.5,
      laneChangeCooldown: 3,
    };
    this.lastDecisionTurn = -1;
    this.strategyPlan = strategyPlan;
    this.decisionHistory = [];
    this.lastDecisionTime = 0;
  }

  makeDecision(): AIDecision {
    const urgency = this.evaluateUrgency();
    const mode = this.determineDrivingMode();
    const targetSpeed = this.calculateOptimalSpeed();
    const targetDirection = this.calculateOptimalDirection();
    const targetAccel = this.calculateTargetAcceleration(targetSpeed);
    const laneChange = this.decideLaneChange();
    const decision: AIDecision = {
      targetSpeed,
      targetDirection,
      targetAccel,
      laneChange,
      urgencyLevel: urgency,
      currentMode: mode,
      reasoning: this.generateReasoning(mode, urgency),
    };
    this.currentMode = mode;
    this.aiDecision = decision;
    this.logDecision(decision);
    return decision;
  }

  update(): AIDecision {
    return this.makeDecision();
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDecision(): AIDecision | null {
    return this.aiDecision;
  }

  private evaluateUrgency(): UrgencyLevel {
    const collision = this.predictCollision();
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

  private determineDrivingMode(): DrivingMode {
    if (this.isEmergencyAvoidanceNeeded()) {
      return DrivingMode.Blocked;
    }
    const horseState = this.getHorseState();
    if (this.situationAnalysis.racePhase === "final") {
      return DrivingMode.LastSpurt;
    }
    if (
      horseState.stamina < 0.3 &&
      this.situationAnalysis.racePhase !== "late"
    ) {
      return DrivingMode.Conserving;
    }
    if (
      this.situationAnalysis.opportunities?.canOvertake &&
      (this.situationAnalysis.racePhase === "late" ||
        this.situationAnalysis.racePhase === "middle")
    ) {
      return DrivingMode.Overtaking;
    }
    if (this.situationAnalysis.drivingMode !== "maintainingPace") {
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
    const staminaFactor = Math.max(0.3, horseState.stamina);
    return baseSpeed * staminaFactor;
  }

  private calculateOptimalDirection(): number {
    const currentHeading = this.horse.raceHeading;
    let targetHeading = currentHeading;
    if (this.currentMode === DrivingMode.Blocked) {
      const collision = this.predictCollision();
      if (collision.avoidanceDirection === AvoidanceDirection.Left) {
        targetHeading = currentHeading - 0.2;
      } else if (collision.avoidanceDirection === AvoidanceDirection.Right) {
        targetHeading = currentHeading + 0.2;
      }
    }
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

  private decideLaneChange(): LaneChange {
    if (this.currentMode === DrivingMode.Blocked) {
      const collision = this.predictCollision();
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

  private generateReasoning(mode: DrivingMode, urgency: string): string {
    return `Mode: ${mode}, Urgency: ${urgency}`;
  }

  private predictCollision(): CollisionPrediction {
    const nearbyHorses = this.environment.nearbyHorses;
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

  private executeAvoidanceManeuver(
    prediction: CollisionPrediction
  ): Partial<AIDecision> {
    if (prediction.severity === CollisionSeverity.High) {
      return {
        targetAccel: -this.horse.maxAccel,
        laneChange:
          prediction.avoidanceDirection === AvoidanceDirection.Left
            ? LaneChange.Inner
            : LaneChange.Outer,
      };
    }
    return {};
  }

  private isEmergencyAvoidanceNeeded(): boolean {
    const collision = this.predictCollision();
    return collision.willCollide && collision.turnsToCollision < 3;
  }

  private executeMaintainingPaceMode(): Partial<AIDecision> {
    return {
      targetAccel: this.horse.maxAccel * 0.3,
    };
  }

  private executeOvertakingMode(): Partial<AIDecision> {
    return {
      targetAccel: this.horse.maxAccel * 0.8,
      laneChange: LaneChange.Outer,
    };
  }

  private executeBlockedMode(): Partial<AIDecision> {
    const collision = this.predictCollision();
    return this.executeAvoidanceManeuver(collision);
  }

  private executePositioningMode(): Partial<AIDecision> {
    return {
      targetAccel: this.horse.maxAccel * 0.5,
    };
  }

  private executeConservingMode(): Partial<AIDecision> {
    return {
      targetAccel: this.horse.maxAccel * 0.2,
    };
  }

  private executeLastSpurtMode(): Partial<AIDecision> {
    return {
      targetAccel: this.horse.maxAccel,
    };
  }

  private getHorseState(): HorseStateInfo {
    return {
      stamina: this.horse.stamina,
      speed: this.horse.speed,
      maxSpeed: this.horse.maxSpeed,
      acceleration: this.horse.accel,
      position: { x: this.horse.x, y: this.horse.y },
      direction: this.horse.raceHeading,
      horseId: this.horse.horseId.toString(),
    };
  }

  private logDecision(decision: AIDecision): void {
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > 100) {
      this.decisionHistory.shift();
    }
  }

  makeDirectionalDecision(currentTurn: number): {
    action: ActionType;
    targetLane?: Lane;
    intensity: number;
    reasoning: string;
  } {
    if (
      currentTurn - this.lastDecisionTurn <
      this.adaptiveParameters.laneChangeCooldown
    ) {
      return {
        action: ActionType.Maintain,
        intensity: 0.5,
        reasoning: "레인 변경 쿨다운 중",
      };
    }

    this.strategyPlan.updateLaneEvaluations();
    const directionalRisk = this.situationAnalysis.directionalRisk;

    if (this.shouldAvoidDanger(directionalRisk)) {
      return this.makeSafetyDecision(directionalRisk, currentTurn);
    }

    if (this.shouldChangeLane()) {
      return this.makeLaneChangeDecision(currentTurn);
    }

    if (this.shouldOvertake()) {
      return this.makeOvertakeDecision(currentTurn);
    }

    if (this.shouldDefend()) {
      return this.makeDefendDecision(currentTurn);
    }

    return {
      action: ActionType.Maintain,
      intensity: this.calculateMaintainIntensity(),
      reasoning: "현재 상황 유지",
    };
  }

  private shouldAvoidDanger(risk: DirectionalRisk): boolean {
    const totalRisk =
      risk.front + risk.left + risk.right + risk.frontLeft + risk.frontRight;
    return totalRisk > this.adaptiveParameters.riskTolerance * 2;
  }

  private makeSafetyDecision(risk: DirectionalRisk, currentTurn: number): any {
    this.lastDecisionTurn = currentTurn;

    if (risk.left < risk.right && risk.left < 0.3) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Inner,
        intensity: 0.8,
        reasoning: "위험 회피를 위한 내측 이동",
      };
    }

    if (risk.right < risk.left && risk.right < 0.3) {
      return {
        action: ActionType.ChangeLane,
        targetLane: Lane.Outer,
        intensity: 0.8,
        reasoning: "위험 회피를 위한 외측 이동",
      };
    }

    return {
      action: ActionType.Defend,
      intensity: 0.9,
      reasoning: "고위험 상황에서 현재 위치 방어",
    };
  }

  private shouldChangeLane(): boolean {
    return this.strategyPlan.shouldChangeLane();
  }

  private makeLaneChangeDecision(currentTurn: number): any {
    this.lastDecisionTurn = currentTurn;
    const recommendation = this.strategyPlan.getLaneChangeRecommendation();

    const intensity = this.calculateLaneChangeIntensity(recommendation.urgency);

    return {
      action: ActionType.ChangeLane,
      targetLane: recommendation.targetLane,
      intensity,
      reasoning: recommendation.reasoning,
    };
  }

  private calculateLaneChangeIntensity(urgency: UrgencyLevel): number {
    const baseIntensity = {
      [UrgencyLevel.Low]: 0.4,
      [UrgencyLevel.Medium]: 0.6,
      [UrgencyLevel.High]: 0.8,
      [UrgencyLevel.Emergency]: 0.9,
    }[urgency];

    const raceProgress = this.situationAnalysis.envData.selfStatus.raceProgress;
    const progressMultiplier = raceProgress > 0.8 ? 1.2 : 1.0;

    return Math.min(
      1.0,
      baseIntensity *
        progressMultiplier *
        this.adaptiveParameters.aggressiveness
    );
  }

  private shouldOvertake(): boolean {
    const opportunities = this.situationAnalysis.opportunities;
    const directionalRisk = this.situationAnalysis.directionalRisk;

    if (!opportunities.canOvertake) return false;

    const riskThreshold = this.adaptiveParameters.riskTolerance;
    const safetyCheck =
      directionalRisk.front < riskThreshold &&
      directionalRisk.frontLeft < riskThreshold &&
      directionalRisk.frontRight < riskThreshold;

    const staminaCheck =
      this.situationAnalysis.envData.selfStatus.stamina >
      this.horse.maxStamina * 0.2;
    const rankMotivation =
      this.situationAnalysis.envData.selfStatus.currentRank > 3;

    return (
      safetyCheck &&
      staminaCheck &&
      (rankMotivation || this.adaptiveParameters.aggressiveness > 0.7)
    );
  }

  private makeOvertakeDecision(currentTurn: number): any {
    this.lastDecisionTurn = currentTurn;

    const envData = this.situationAnalysis.envData;
    const rank = envData.selfStatus.currentRank;
    const raceProgress = envData.selfStatus.raceProgress;

    let intensity = 0.6;

    if (rank > 5) intensity += 0.2;
    if (raceProgress > 0.7) intensity += 0.15;

    intensity *= this.adaptiveParameters.aggressiveness;
    intensity = Math.min(0.95, intensity);

    return {
      action: ActionType.Overtake,
      intensity,
      reasoning: `추월 시도 (현재 ${rank}위, 진행률 ${(
        raceProgress * 100
      ).toFixed(1)}%)`,
    };
  }

  private shouldDefend(): boolean {
    const envData = this.situationAnalysis.envData;
    const rank = envData.selfStatus.currentRank;
    const raceProgress = envData.selfStatus.raceProgress;

    if (rank > 3) return false;

    const nearbyHorses = envData.nearbyHorses;
    const hasNearbyThreat = Object.values(nearbyHorses.distances).some(
      (distance) => distance < 30
    );

    return hasNearbyThreat && raceProgress > 0.6;
  }

  private makeDefendDecision(currentTurn: number): any {
    this.lastDecisionTurn = currentTurn;

    const envData = this.situationAnalysis.envData;
    const rank = envData.selfStatus.currentRank;

    let intensity = 0.7;
    if (rank <= 2) intensity += 0.2;

    return {
      action: ActionType.Defend,
      intensity,
      reasoning: `현재 ${rank}위 유지를 위한 방어`,
    };
  }

  private calculateMaintainIntensity(): number {
    const envData = this.situationAnalysis.envData;
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
