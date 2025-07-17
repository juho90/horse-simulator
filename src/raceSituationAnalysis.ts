import { DirectionalRisk, RiskAnalysisDetail } from "./directionalRisk";
import { DrivingMode } from "./drivingMode";
import { Lane, RacePhase } from "./laneEvaluation";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";

export interface Opportunities {
  canOvertake: boolean;
  canMoveInner: boolean;
  canMoveOuter: boolean;
}

export class RaceSituationAnalysis {
  racePhase: RacePhase;
  riskLevel: number;
  opportunities: Opportunities;
  drivingMode: DrivingMode;
  directionalRisk: DirectionalRisk;
  riskAnalysisDetail: RiskAnalysisDetail;

  private performanceTracker = {
    calculationCount: 0,
    cacheHits: 0,
    averageCalculationTime: 0,
    totalCalculationTime: 0,
  };
  private lastRiskCalculationTurn: number = -1;
  private cachedDirectionalRisk: DirectionalRisk | null = null;

  constructor(private horse: RaceHorse, public envData: RaceEnvironment) {
    this.racePhase = RacePhase.Early;
    this.riskLevel = 0;
    this.opportunities = {
      canOvertake: false,
      canMoveInner: false,
      canMoveOuter: false,
    };
    this.drivingMode = DrivingMode.MaintainingPace;
    this.directionalRisk = {
      front: 0,
      left: 0,
      right: 0,
      frontLeft: 0,
      frontRight: 0,
      overall: 0,
    };
    this.riskAnalysisDetail = {
      wallRisk: this.directionalRisk,
      horseRisk: this.directionalRisk,
      speedRisk: this.directionalRisk,
      cornerRisk: this.directionalRisk,
      combined: this.directionalRisk,
    };
  }

  update(): void {
    this.racePhase = this.determineRacePhase();
    this.riskLevel = this.calculateRiskLevel();
    this.opportunities = this.identifyOpportunities();
    this.drivingMode = this.determineRecommendedState();
    this.riskAnalysisDetail = this.analyzeDirectionalRisks();
    this.directionalRisk = this.riskAnalysisDetail.combined;
  }

  updateAnalysis(currentTurn: number): void {
    this.riskAnalysisDetail = this.analyzeDirectionalRisks();
    this.directionalRisk = this.riskAnalysisDetail.combined;
    this.riskLevel = this.calculateOverallRisk(
      Object.values(this.directionalRisk)
    );
    this.opportunities = this.identifyOpportunities();
    this.racePhase = this.determineRacePhase();
    this.drivingMode = this.determineRecommendedState();
  }

  private determineRacePhase(): RacePhase {
    const progress = this.envData.selfStatus.raceProgress;
    if (progress < 0.25) {
      return RacePhase.Early;
    } else if (progress < 0.65) {
      return RacePhase.Middle;
    } else if (progress < 0.85) {
      return RacePhase.Late;
    } else {
      return RacePhase.Final;
    }
  }

  private calculateRiskLevel(): number {
    const startTime = performance.now();
    let totalRisk = 0;
    totalRisk += this.directionalRisk.front * 1.5;
    totalRisk += this.directionalRisk.left * 1.0;
    totalRisk += this.directionalRisk.right * 1.0;
    totalRisk += this.directionalRisk.frontLeft * 1.2;
    totalRisk += this.directionalRisk.frontRight * 1.2;
    const endTime = performance.now();
    this.updatePerformanceTracker(endTime - startTime);
    return Math.min(1.0, totalRisk / 5);
  }

  private updatePerformanceTracker(calculationTime: number): void {
    this.performanceTracker.calculationCount++;
    this.performanceTracker.totalCalculationTime += calculationTime;
    this.performanceTracker.averageCalculationTime =
      this.performanceTracker.totalCalculationTime /
      this.performanceTracker.calculationCount;
  }

  private calculateOverallRisk(riskValues: number[]): number {
    if (riskValues.length === 0) return 0;
    return riskValues.reduce((sum, risk) => sum + risk, 0) / riskValues.length;
  }

  private calculateMinDistance(): number {
    let minDistance = Infinity;
    for (const raycast of this.envData.trackInfo.raycasts) {
      if (raycast.hitDistance < minDistance) {
        minDistance = raycast.hitDistance;
      }
    }
    return minDistance === Infinity ? 50 : minDistance;
  }

  private identifyOpportunities(): Opportunities {
    const canOvertake = !!(
      this.envData.nearbyHorses.front &&
      this.envData.nearbyHorses.distances[
        this.envData.nearbyHorses.front.horseId
      ] < 30 &&
      (!this.envData.nearbyHorses.left ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.left.horseId
        ] > 20)
    );
    const canMoveInner =
      this.envData.trackInfo.currentLane !== Lane.Inner &&
      (!this.envData.nearbyHorses.left ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.left.horseId
        ] > 25);
    const canMoveOuter =
      this.envData.trackInfo.currentLane !== Lane.Outer &&
      (!this.envData.nearbyHorses.right ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.right.horseId
        ] > 25);
    return { canOvertake, canMoveInner, canMoveOuter };
  }

  private determineRecommendedState(): DrivingMode {
    if (this.isEmergencySituation()) {
      return this.getEmergencyState();
    }
    if (this.shouldConsiderOvertaking()) {
      return DrivingMode.Overtaking;
    }
    if (this.isInFinalStretch()) {
      return DrivingMode.LastSpurt;
    }
    if (this.shouldBlockCompetitor()) {
      return DrivingMode.Blocked;
    }
    return DrivingMode.MaintainingPace;
  }

  private isEmergencySituation(): boolean {
    return this.riskLevel > 0.8 || this.directionalRisk.front > 0.9;
  }

  private getEmergencyState(): DrivingMode {
    if (this.opportunities.canMoveInner || this.opportunities.canMoveOuter) {
      return DrivingMode.Overtaking;
    }
    return DrivingMode.Blocked;
  }

  private shouldConsiderOvertaking(): boolean {
    return (
      this.opportunities.canOvertake &&
      this.riskLevel < 0.5 &&
      this.horse.stamina > this.horse.maxStamina * 0.3
    );
  }

  private isInFinalStretch(): boolean {
    return (
      this.racePhase === RacePhase.Final &&
      this.horse.stamina > this.horse.maxStamina * 0.2
    );
  }

  private shouldBlockCompetitor(): boolean {
    const nearbyHorses = this.envData.nearbyHorses;
    return (
      !!(nearbyHorses.left || nearbyHorses.right) && this.racePhase === "final"
    );
  }

  analyzeDirectionalRisks(): RiskAnalysisDetail {
    const currentTurn = this.envData.selfStatus.currentRank;
    if (
      this.lastRiskCalculationTurn === currentTurn &&
      this.cachedDirectionalRisk
    ) {
      this.performanceTracker.cacheHits++;
      return {
        wallRisk: this.cachedDirectionalRisk,
        horseRisk: this.cachedDirectionalRisk,
        speedRisk: this.cachedDirectionalRisk,
        cornerRisk: this.cachedDirectionalRisk,
        combined: this.cachedDirectionalRisk,
      };
    }
    const wallRisk = this.analyzeWallRisk();
    const horseRisk = this.analyzeHorseProximityRisk();
    const speedRisk = this.analyzeSpeedRisk();
    const cornerRisk = this.analyzeCornerRisk();
    const combined: DirectionalRisk = {
      front: Math.max(
        wallRisk.front,
        horseRisk.front,
        speedRisk.front,
        cornerRisk.front
      ),
      left: Math.max(
        wallRisk.left,
        horseRisk.left,
        speedRisk.left,
        cornerRisk.left
      ),
      right: Math.max(
        wallRisk.right,
        horseRisk.right,
        speedRisk.right,
        cornerRisk.right
      ),
      frontLeft: Math.max(
        wallRisk.frontLeft,
        horseRisk.frontLeft,
        speedRisk.frontLeft,
        cornerRisk.frontLeft
      ),
      frontRight: Math.max(
        wallRisk.frontRight,
        horseRisk.frontRight,
        speedRisk.frontRight,
        cornerRisk.frontRight
      ),
      overall: 0,
    };
    combined.overall =
      (combined.front +
        combined.left +
        combined.right +
        combined.frontLeft +
        combined.frontRight) /
      5;
    this.lastRiskCalculationTurn = currentTurn;
    this.cachedDirectionalRisk = combined;
    return {
      wallRisk,
      horseRisk,
      speedRisk,
      cornerRisk,
      combined,
    };
  }

  private analyzeWallRisk(): DirectionalRisk {
    const minDistance = this.calculateMinDistance();
    const criticalDistance = 20;
    const warningDistance = 35;
    let riskFactor = 0;
    if (minDistance < criticalDistance) {
      riskFactor = 1.0 - minDistance / criticalDistance;
    } else if (minDistance < warningDistance) {
      riskFactor =
        0.3 *
        (1.0 -
          (minDistance - criticalDistance) /
            (warningDistance - criticalDistance));
    }
    return {
      front: riskFactor * 0.8,
      left: riskFactor * 0.6,
      right: riskFactor * 0.6,
      frontLeft: riskFactor * 0.7,
      frontRight: riskFactor * 0.7,
      overall: riskFactor * 0.7,
    };
  }

  private analyzeHorseProximityRisk(): DirectionalRisk {
    const nearbyHorses = this.envData.nearbyHorses;
    const distances = this.envData.nearbyHorses.distances;
    let frontRisk = 0;
    let leftRisk = 0;
    let rightRisk = 0;
    if (nearbyHorses.front) {
      const distance = distances[nearbyHorses.front.horseId];
      if (distance < 30) {
        frontRisk = Math.max(0, 1.0 - distance / 30);
      }
    }
    if (nearbyHorses.left) {
      const distance = distances[nearbyHorses.left.horseId];
      if (distance < 25) {
        leftRisk = Math.max(0, 1.0 - distance / 25);
      }
    }
    if (nearbyHorses.right) {
      const distance = distances[nearbyHorses.right.horseId];
      if (distance < 25) {
        rightRisk = Math.max(0, 1.0 - distance / 25);
      }
    }
    return {
      front: frontRisk,
      left: leftRisk,
      right: rightRisk,
      frontLeft: Math.max(frontRisk, leftRisk) * 0.8,
      frontRight: Math.max(frontRisk, rightRisk) * 0.8,
      overall: (frontRisk + leftRisk + rightRisk) / 3,
    };
  }

  private analyzeSpeedRisk(): DirectionalRisk {
    const currentSpeed = this.envData.selfStatus.speed;
    const maxSpeed = this.horse.maxSpeed;
    const speedRatio = currentSpeed / maxSpeed;
    let baseRisk = 0;
    if (speedRatio > 0.9) {
      baseRisk = (speedRatio - 0.9) / 0.1;
    }
    const stamina = this.envData.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    if (staminaRatio < 0.2) {
      baseRisk *= 1.5;
    } else if (staminaRatio < 0.5) {
      baseRisk *= 1.2;
    }
    return {
      front: baseRisk * 0.2,
      left: baseRisk,
      right: baseRisk,
      frontLeft: baseRisk * 0.6,
      frontRight: baseRisk * 0.6,
      overall: baseRisk * 0.7,
    };
  }

  private analyzeCornerRisk(): DirectionalRisk {
    const cornerApproach = this.envData.trackInfo.cornerApproach;
    if (Math.abs(cornerApproach) < 0.1) {
      return {
        front: 0,
        left: 0,
        right: 0,
        frontLeft: 0,
        frontRight: 0,
        overall: 0,
      };
    }
    const intensity = Math.abs(cornerApproach);
    const currentSpeed = this.envData.selfStatus.speed;
    const speedFactor = Math.min(
      1.0,
      currentSpeed / (this.horse.maxSpeed * 0.7)
    );
    const baseRisk = intensity * speedFactor * 0.6;
    if (cornerApproach > 0) {
      return {
        front: baseRisk * 0.3,
        left: baseRisk,
        right: baseRisk * 0.2,
        frontLeft: baseRisk * 0.8,
        frontRight: baseRisk * 0.4,
        overall: baseRisk * 0.6,
      };
    } else {
      return {
        front: baseRisk * 0.3,
        left: baseRisk * 0.2,
        right: baseRisk,
        frontLeft: baseRisk * 0.4,
        frontRight: baseRisk * 0.8,
        overall: baseRisk * 0.6,
      };
    }
  }
}
