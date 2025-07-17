import {
  Lane,
  LaneEvaluation,
  PhaseWeights,
  RacePhase,
} from "./laneEvaluation";
import { UrgencyLevel } from "./raceAI";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export class RaceStrategyPlan {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  currentPhase: RacePhase;
  laneEvaluations: LaneEvaluation[];
  recommendedLane: Lane;

  private phaseWeights: { [key in RacePhase]: PhaseWeights } = {
    [RacePhase.Early]: { safety: 0.6, efficiency: 0.3, opportunity: 0.1 },
    [RacePhase.Middle]: { safety: 0.4, efficiency: 0.4, opportunity: 0.2 },
    [RacePhase.Late]: { safety: 0.3, efficiency: 0.3, opportunity: 0.4 },
    [RacePhase.Final]: { safety: 0.2, efficiency: 0.2, opportunity: 0.6 },
  };

  constructor(
    private horse: RaceHorse,
    private analysis: RaceSituationAnalysis
  ) {
    this.targetSpeed = 0;
    this.targetDirection = 0;
    this.targetAccel = 0;
    this.currentPhase = RacePhase.Early;
    this.laneEvaluations = [];
    this.recommendedLane = Lane.Middle;
  }

  update(): string {
    this.targetSpeed = this.calculateTargetSpeed();
    this.targetDirection = this.calculateTargetDirection();
    this.targetAccel = this.calculateTargetAccel();
    this.currentPhase = this.determineRacePhase();
    this.laneEvaluations = this.evaluateAllLanes();
    this.recommendedLane = this.selectOptimalLane();
    return `Phase: ${this.currentPhase}, Recommended Lane: ${this.recommendedLane}`;
  }

  private calculateTargetSpeed(): number {
    const staminaRatio = this.horse.stamina / this.horse.maxStamina;
    let baseSpeed = this.horse.maxSpeed;
    if (this.analysis.racePhase === "final") {
      baseSpeed *= 0.95;
    } else if (staminaRatio < 0.3) {
      baseSpeed *= 0.6;
    } else if (this.analysis.drivingMode === "overtaking") {
      baseSpeed *= 0.9;
    } else {
      baseSpeed *= 0.8;
    }
    return Math.min(
      baseSpeed,
      this.horse.maxSpeed *
        (staminaRatio >= 0.5 ? 1.0 : Math.max(0.3, staminaRatio * 2))
    );
  }

  private calculateTargetDirection(): number {
    return this.horse.segment.getTangentDirectionAt(this.horse.x, this.horse.y);
  }

  private calculateTargetAccel(): number {
    const speedDiff = this.targetSpeed - this.horse.speed;
    return Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, speedDiff * 0.5)
    );
  }

  private determineRacePhase(): RacePhase {
    const raceProgress = this.analysis.envData.selfStatus.raceProgress;
    if (raceProgress < 0.25) {
      return RacePhase.Early;
    } else if (raceProgress < 0.65) {
      return RacePhase.Middle;
    } else if (raceProgress < 0.85) {
      return RacePhase.Late;
    } else {
      return RacePhase.Final;
    }
  }

  private evaluateAllLanes(): LaneEvaluation[] {
    const lanes: Lane[] = [Lane.Inner, Lane.Middle, Lane.Outer];
    const currentLane = this.analysis.envData.trackInfo.currentLane;
    return lanes.map((lane) => {
      const safety = this.calculateLaneSafety(lane);
      const efficiency = this.calculateLaneEfficiency(lane);
      const opportunity = this.calculateLaneOpportunity(lane);
      const transitionCost = this.calculateTransitionCost(currentLane, lane);
      const weights = this.phaseWeights[this.currentPhase];
      const totalScore =
        safety * weights.safety +
        efficiency * weights.efficiency +
        opportunity * weights.opportunity -
        transitionCost;
      return {
        lane,
        safety,
        efficiency,
        opportunity,
        totalScore,
        transitionCost,
        reasoning: this.generateLaneReasoning(
          lane,
          safety,
          efficiency,
          opportunity,
          weights
        ),
      };
    });
  }

  private calculateLaneSafety(lane: Lane): number {
    const directionalRisk = this.analysis.directionalRisk;
    const nearbyHorses = this.analysis.envData.nearbyHorses;
    const currentLane = this.analysis.envData.trackInfo.currentLane;
    let baseSafety = 1.0;
    if (lane === Lane.Inner) {
      baseSafety -= directionalRisk.left * 0.8;
      baseSafety -= directionalRisk.frontLeft * 0.6;
      if (nearbyHorses.left) {
        const distance = nearbyHorses.distances[nearbyHorses.left.horseId];
        if (distance < 25) baseSafety -= 0.3;
      }
    } else if (lane === Lane.Outer) {
      baseSafety -= directionalRisk.right * 0.8;
      baseSafety -= directionalRisk.frontRight * 0.6;
      if (nearbyHorses.right) {
        const distance = nearbyHorses.distances[nearbyHorses.right.horseId];
        if (distance < 25) {
          baseSafety -= 0.3;
        }
      }
    } else {
      baseSafety -= directionalRisk.front * 0.4;
      baseSafety -= (directionalRisk.left + directionalRisk.right) * 0.25;
      let sideHorseCount = 0;
      if (nearbyHorses.left) {
        sideHorseCount++;
      }
      if (nearbyHorses.right) {
        sideHorseCount++;
      }
      if (sideHorseCount >= 2) {
        baseSafety -= 0.2;
      }
    }
    const cornerApproach = this.analysis.envData.trackInfo.cornerApproach;
    if (Math.abs(cornerApproach) > 0.05) {
      if (cornerApproach > 0) {
        if (lane === Lane.Inner) {
          baseSafety += 0.15;
        }
        if (lane === Lane.Outer) {
          baseSafety -= 0.25;
        }
      } else {
        if (lane === Lane.Outer) {
          baseSafety += 0.15;
        }
        if (lane === Lane.Inner) {
          baseSafety -= 0.25;
        }
      }
    }
    if (lane !== currentLane) {
      const transitionRisk = this.calculateTransitionSafetyPenalty(
        currentLane,
        lane
      );
      baseSafety -= transitionRisk;
    }
    return Math.max(0, Math.min(1, baseSafety));
  }

  private calculateTransitionSafetyPenalty(from: Lane, to: Lane): number {
    if (
      (from === Lane.Inner && to === Lane.Outer) ||
      (from === Lane.Outer && to === Lane.Inner)
    ) {
      return 0.2;
    }
    return 0.1;
  }

  private calculateLaneEfficiency(lane: Lane): number {
    let efficiency = 0.8;
    if (lane === Lane.Inner) {
      efficiency += 0.2;
    } else if (lane === Lane.Middle) {
      efficiency += 0.1;
    } else {
      efficiency -= 0.05;
    }
    const currentDistanceRatio = this.horse.raceDistance / 2400;
    if (currentDistanceRatio > 1.02) {
      if (lane === Lane.Inner) {
        efficiency += 0.15;
      } else if (lane === Lane.Outer) {
        efficiency -= 0.2;
      }
    }
    const nearbyHorses = this.analysis.envData.nearbyHorses;
    let trafficDensity = 0;
    if (lane === Lane.Inner) {
      if (nearbyHorses.left) {
        const distance = nearbyHorses.distances[nearbyHorses.left.horseId];
        trafficDensity += distance < 30 ? 0.4 : 0.2;
      }
    } else if (lane === Lane.Outer) {
      if (nearbyHorses.right) {
        const distance = nearbyHorses.distances[nearbyHorses.right.horseId];
        trafficDensity += distance < 30 ? 0.4 : 0.2;
      }
    } else {
      if (nearbyHorses.left) {
        const distance = nearbyHorses.distances[nearbyHorses.left.horseId];
        trafficDensity += distance < 35 ? 0.25 : 0.1;
      }
      if (nearbyHorses.right) {
        const distance = nearbyHorses.distances[nearbyHorses.right.horseId];
        trafficDensity += distance < 35 ? 0.25 : 0.1;
      }
      if (nearbyHorses.front) {
        const distance = nearbyHorses.distances[nearbyHorses.front.horseId];
        trafficDensity += distance < 40 ? 0.3 : 0.15;
      }
    }
    efficiency -= trafficDensity;
    const currentSpeed = this.analysis.envData.selfStatus.speed;
    const speedRatio = currentSpeed / this.horse.maxSpeed;
    if (speedRatio > 0.8) {
      if (lane === Lane.Outer) {
        efficiency += 0.12;
      } else if (lane === Lane.Inner) {
        efficiency -= 0.08;
      }
    } else if (speedRatio < 0.4) {
      if (lane === Lane.Inner) {
        efficiency += 0.08;
      }
    }
    const stamina = this.analysis.envData.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    if (staminaRatio < 0.3) {
      if (lane === Lane.Inner) {
        efficiency += 0.15;
      } else if (lane === Lane.Outer) {
        efficiency -= 0.1;
      }
    }
    const raceProgress = this.analysis.envData.selfStatus.raceProgress;
    if (raceProgress > 0.8) {
      if (lane === Lane.Inner) {
        efficiency += 0.12;
      }
    }
    return Math.max(0, Math.min(1, efficiency));
  }

  private calculateLaneOpportunity(lane: Lane): number {
    let opportunity = 0.5;
    const currentRank = this.analysis.envData.selfStatus.currentRank;
    const raceProgress = this.analysis.envData.selfStatus.raceProgress;
    const nearbyHorses = this.analysis.envData.nearbyHorses;
    const opportunities = this.analysis.opportunities;
    if (opportunities.canOvertake) {
      if (lane === Lane.Outer) {
        let outerBonus = 0.35;
        if (nearbyHorses.front && !nearbyHorses.right) {
          outerBonus += 0.2;
        }
        if (raceProgress > 0.7) {
          outerBonus += 0.15;
        }
        opportunity += outerBonus;
      } else if (lane === Lane.Inner && opportunities.canMoveInner) {
        let innerBonus = 0.25;
        if (!nearbyHorses.left && nearbyHorses.front) {
          innerBonus += 0.2;
        }
        if (raceProgress < 0.6) {
          innerBonus += 0.1;
        }
        opportunity += innerBonus;
      }
    }
    if (currentRank > 5) {
      if (lane === Lane.Outer) {
        opportunity += 0.25;
      } else if (lane === Lane.Inner) {
        opportunity += 0.15;
      }
    } else if (currentRank <= 3) {
      if (lane === Lane.Middle) {
        opportunity += 0.2;
      }
      const currentLane = this.analysis.envData.trackInfo.currentLane;
      if (lane === currentLane) {
        opportunity += 0.1;
      }
    }
    if (this.currentPhase === RacePhase.Final) {
      if (lane === Lane.Outer) {
        opportunity += 0.3;
      }
      if (lane === Lane.Inner) {
        opportunity -= 0.15;
      }
    } else if (this.currentPhase === RacePhase.Early) {
      if (lane === Lane.Inner) {
        opportunity += 0.15;
      }
    }
    const stamina = this.analysis.envData.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    if (staminaRatio > 0.7) {
      if (lane === Lane.Outer) {
        opportunity += 0.1;
      }
    } else if (staminaRatio < 0.3) {
      if (lane === Lane.Inner) {
        opportunity += 0.1;
      }
    }
    return Math.max(0, Math.min(1, opportunity));
  }

  private calculateTransitionCost(from: Lane, to: Lane): number {
    if (from === to) {
      return 0;
    }
    let baseCost = 0.08;
    if (
      (from === Lane.Inner && to === Lane.Outer) ||
      (from === Lane.Outer && to === Lane.Inner)
    ) {
      baseCost = 0.25;
    } else {
      baseCost = 0.12;
    }
    const currentSpeed = this.analysis.envData.selfStatus.speed;
    const speedRatio = currentSpeed / this.horse.maxSpeed;
    baseCost *= 1 + speedRatio * 0.4;
    const directionalRisk = this.analysis.directionalRisk;
    const nearbyHorses = this.analysis.envData.nearbyHorses;
    if (to === Lane.Inner) {
      baseCost += directionalRisk.left * 0.35;
      if (nearbyHorses.left) {
        const distance = nearbyHorses.distances[nearbyHorses.left.horseId];
        if (distance < 20) {
          baseCost += 0.4;
        } else if (distance < 35) {
          baseCost += 0.2;
        }
      }
    }
    if (to === Lane.Outer) {
      baseCost += directionalRisk.right * 0.35;
      if (nearbyHorses.right) {
        const distance = nearbyHorses.distances[nearbyHorses.right.horseId];
        if (distance < 20) {
          baseCost += 0.4;
        } else if (distance < 35) {
          baseCost += 0.2;
        }
      }
    }
    const cornerApproach = this.analysis.envData.trackInfo.cornerApproach;
    if (Math.abs(cornerApproach) > 0.1) {
      baseCost += 0.15;
    }
    const stamina = this.analysis.envData.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    if (staminaRatio < 0.3) {
      baseCost += 0.2;
    }
    const raceProgress = this.analysis.envData.selfStatus.raceProgress;
    if (raceProgress > 0.8) {
      baseCost += 0.1;
    }
    return Math.min(0.8, baseCost);
  }

  private selectOptimalLane(): Lane {
    const sortedLanes = this.laneEvaluations.sort(
      (a, b) => b.totalScore - a.totalScore
    );
    return sortedLanes[0].lane;
  }

  private generateLaneReasoning(
    lane: Lane,
    safety: number,
    efficiency: number,
    opportunity: number,
    weights: PhaseWeights
  ): string {
    const scores = {
      safety: (safety * weights.safety).toFixed(2),
      efficiency: (efficiency * weights.efficiency).toFixed(2),
      opportunity: (opportunity * weights.opportunity).toFixed(2),
    };
    return `${lane}: 안전도${scores.safety} 효율성${scores.efficiency} 기회도${scores.opportunity}`;
  }

  updateLaneEvaluations(): void {
    this.currentPhase = this.determineRacePhase();
    this.laneEvaluations = this.evaluateAllLanes();
    this.recommendedLane = this.selectOptimalLane();
  }

  shouldChangeLane(): boolean {
    if (!this.laneEvaluations || this.laneEvaluations.length === 0) {
      this.updateLaneEvaluations();
    }
    const currentLane = this.analysis.envData.trackInfo.currentLane;
    const optimalEvaluation = this.laneEvaluations.find(
      (le) => le.lane === this.recommendedLane
    );
    const currentEvaluation = this.laneEvaluations.find(
      (le) => le.lane === currentLane
    );
    if (!optimalEvaluation || !currentEvaluation) return false;
    const scoreDifference =
      optimalEvaluation.totalScore - currentEvaluation.totalScore;
    const thresholds = {
      [RacePhase.Early]: 0.15,
      [RacePhase.Middle]: 0.12,
      [RacePhase.Late]: 0.08,
      [RacePhase.Final]: 0.05,
    };
    return (
      scoreDifference > thresholds[this.currentPhase] &&
      optimalEvaluation.transitionCost < 0.4
    );
  }

  getOptimalLane(): Lane {
    if (!this.recommendedLane) {
      this.updateLaneEvaluations();
    }
    return this.recommendedLane;
  }

  getLaneChangeRecommendation(): {
    shouldChange: boolean;
    targetLane: Lane;
    urgency: UrgencyLevel;
    reasoning: string;
  } {
    const shouldChange = this.shouldChangeLane();
    const targetLane = this.getOptimalLane();
    if (!shouldChange) {
      return {
        shouldChange: false,
        targetLane,
        urgency: UrgencyLevel.Low,
        reasoning: "현재 레인이 최적",
      };
    }
    const currentLane = this.analysis.envData.trackInfo.currentLane;
    const optimalEvaluation = this.laneEvaluations.find(
      (le) => le.lane === targetLane
    );
    const currentEvaluation = this.laneEvaluations.find(
      (le) => le.lane === currentLane
    );
    if (!optimalEvaluation || !currentEvaluation) {
      return {
        shouldChange: false,
        targetLane,
        urgency: UrgencyLevel.Low,
        reasoning: "평가 데이터 부족",
      };
    }
    const scoreDifference =
      optimalEvaluation.totalScore - currentEvaluation.totalScore;
    const urgency = this.determineUrgency(
      scoreDifference,
      optimalEvaluation.transitionCost
    );
    return {
      shouldChange: true,
      targetLane,
      urgency,
      reasoning: `${targetLane} 레인으로 변경 권장 (점수차: ${scoreDifference.toFixed(
        2
      )})`,
    };
  }

  private determineUrgency(
    scoreDifference: number,
    transitionCost: number
  ): UrgencyLevel {
    const benefit = scoreDifference - transitionCost;
    if (benefit > 0.3) {
      return UrgencyLevel.High;
    }
    if (benefit > 0.15) {
      return UrgencyLevel.Medium;
    }
    return UrgencyLevel.Low;
  }
}
