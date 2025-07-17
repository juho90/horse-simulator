import { DrivingMode } from "./drivingMode";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";
import { RaceStrategyPlan } from "./raceStrategyPlan";

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  laneChange: "inner" | "outer" | "stay";
  urgencyLevel: "low" | "medium" | "high" | "emergency";
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
  avoidanceDirection: "left" | "right" | "brake";
  severity: "low" | "medium" | "high";
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

  private evaluateUrgency(): "low" | "medium" | "high" | "emergency" {
    const collision = this.predictCollision();
    if (collision.willCollide && collision.turnsToCollision < 2) {
      return "emergency";
    }
    if (collision.willCollide && collision.turnsToCollision < 4) {
      return "high";
    }
    const horseState = this.getHorseState();
    if (horseState.stamina < 0.2) {
      return "medium";
    }
    return "low";
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
      if (collision.avoidanceDirection === "left") {
        targetHeading = currentHeading - 0.2;
      } else if (collision.avoidanceDirection === "right") {
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

  private decideLaneChange(): "inner" | "outer" | "stay" {
    if (this.currentMode === DrivingMode.Blocked) {
      const collision = this.predictCollision();
      if (collision.avoidanceDirection === "left") {
        return "inner";
      } else if (collision.avoidanceDirection === "right") {
        return "outer";
      }
    }
    if (this.currentMode === DrivingMode.Overtaking) {
      return "outer";
    }
    return "stay";
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
            avoidanceDirection: other.x > this.horse.x ? "left" : "right",
            severity: turnsToCollision < 2 ? "high" : "medium",
          };
        }
      }
    }
    return {
      willCollide: false,
      turnsToCollision: Infinity,
      avoidanceDirection: "brake",
      severity: "low",
    };
  }

  private executeAvoidanceManeuver(
    prediction: CollisionPrediction
  ): Partial<AIDecision> {
    if (prediction.severity === "high") {
      return {
        targetAccel: -this.horse.maxAccel,
        laneChange:
          prediction.avoidanceDirection === "left" ? "inner" : "outer",
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
      laneChange: "outer",
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
}
