import {
  DirectionalDistance,
  DirectionalDistanceUtils,
  DirectionalDistanceWithSource,
  DistanceAnalysisDetail,
  DistanceSource,
} from "./directionalDistance";
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
  dirDistanceWithSource: DirectionalDistanceWithSource;
  isBlocked: boolean;
  racePhase: RacePhase;
  opportunities: Opportunities;
  drivingMode: DrivingMode;

  constructor(private horse: RaceHorse, private raceEnv: RaceEnvironment) {
    this.dirDistanceWithSource = {
      front: { source: DistanceSource.Unknown, distance: Infinity },
      left: { source: DistanceSource.Unknown, distance: Infinity },
      right: { source: DistanceSource.Unknown, distance: Infinity },
      frontLeft: { source: DistanceSource.Unknown, distance: Infinity },
      frontRight: {
        source: DistanceSource.Unknown,
        distance: Infinity,
      },
      minValue: { source: DistanceSource.Unknown, distance: Infinity },
    };
    this.isBlocked = false;
    this.drivingMode = DrivingMode.MaintainingPace;
    this.opportunities = {
      canOvertake: false,
      canMoveInner: false,
      canMoveOuter: false,
    };
    this.racePhase = RacePhase.Early;
  }

  update(): void {
    const distanceAnalysisDetail = this.analyzeDirectionalDetails();
    this.dirDistanceWithSource =
      DirectionalDistanceUtils.combineDirectionalDistance(
        distanceAnalysisDetail
      );
    this.isBlocked = this.calculateBlockedState();
    this.racePhase = this.determineRacePhase();
    this.opportunities = this.identifyOpportunities();
    this.drivingMode = this.determineRecommendedState();
  }

  private calculateBlockedState(): boolean {
    const ESCAPE_THRESHOLD = 20;
    const CRITICAL_THRESHOLD = 10;
    const distances = [
      this.dirDistanceWithSource.front.distance,
      this.dirDistanceWithSource.left.distance,
      this.dirDistanceWithSource.right.distance,
      this.dirDistanceWithSource.frontLeft.distance,
      this.dirDistanceWithSource.frontRight.distance,
    ];
    const realDistances = distances.filter((d) => d !== Infinity && d > 0);
    if (realDistances.length === 0) {
      return false;
    }
    const frontDistance = this.dirDistanceWithSource.front.distance;
    const leftDistance = this.dirDistanceWithSource.left.distance;
    const rightDistance = this.dirDistanceWithSource.right.distance;
    const frontBlocked = frontDistance < ESCAPE_THRESHOLD;
    const leftBlocked = leftDistance < ESCAPE_THRESHOLD;
    const rightBlocked = rightDistance < ESCAPE_THRESHOLD;
    const sidesBlocked = leftBlocked && rightBlocked;
    const allDirectionsCritical = realDistances.every(
      (d) => d < CRITICAL_THRESHOLD
    );
    const blocked = (frontBlocked && sidesBlocked) || allDirectionsCritical;
    return blocked;
  }

  private determineRacePhase(): RacePhase {
    const progress = this.raceEnv.selfStatus.raceProgress;
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

  private identifyOpportunities(): Opportunities {
    const canOvertake = !!(
      this.raceEnv.nearbyHorses.front &&
      this.raceEnv.nearbyHorses.distances[
        this.raceEnv.nearbyHorses.front.horseId
      ] < 30 &&
      (!this.raceEnv.nearbyHorses.left ||
        this.raceEnv.nearbyHorses.distances[
          this.raceEnv.nearbyHorses.left.horseId
        ] > 20)
    );
    const canMoveInner =
      this.raceEnv.trackInfo.currentLane !== Lane.Inner &&
      (!this.raceEnv.nearbyHorses.left ||
        this.raceEnv.nearbyHorses.distances[
          this.raceEnv.nearbyHorses.left.horseId
        ] > 25);
    const canMoveOuter =
      this.raceEnv.trackInfo.currentLane !== Lane.Outer &&
      (!this.raceEnv.nearbyHorses.right ||
        this.raceEnv.nearbyHorses.distances[
          this.raceEnv.nearbyHorses.right.horseId
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
    // 블럭된 상태이거나 전방 거리가 매우 가까운 경우
    const frontDistance = this.dirDistanceWithSource.front.distance;
    return this.isBlocked || frontDistance < 5;
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
      !this.isBlocked && // 블럭되지 않은 상태에서만 추월 고려
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
    const nearbyHorses = this.raceEnv.nearbyHorses;
    return (
      !!(nearbyHorses.left || nearbyHorses.right) && this.racePhase === "final"
    );
  }

  analyzeDirectionalDetails(): DistanceAnalysisDetail {
    const wallDistance = this.analyzeWallDistance();
    const horseDistance = this.analyzeHorseDistance();
    const speedAdjustedDistance = this.analyzeSpeedDistance();
    const cornerDistance = this.analyzeCornerDistance();
    return {
      wallDistance,
      horseDistance,
      speedAdjustedDistance,
      cornerDistance,
    };
  }

  private analyzeWallDistance(): DirectionalDistance {
    const closestRaycasts = this.raceEnv.closestRaycasts;
    if (!closestRaycasts || closestRaycasts.length === 0) {
      return {
        frontDistance: Infinity,
        leftDistance: Infinity,
        rightDistance: Infinity,
        frontLeftDistance: Infinity,
        frontRightDistance: Infinity,
        minDistance: Infinity,
      };
    }
    const currentHeading = this.horse.raceHeading;
    const leftRaycast = closestRaycasts.find(
      (raycast) =>
        Math.abs(raycast.rayAngle - (currentHeading - Math.PI / 2)) < 0.2
    );
    const rightRaycast = closestRaycasts.find(
      (raycast) =>
        Math.abs(raycast.rayAngle - (currentHeading + Math.PI / 2)) < 0.2
    );
    const frontRaycast = closestRaycasts.find(
      (raycast) => Math.abs(raycast.rayAngle - currentHeading) < 0.2
    );
    const frontDistance = frontRaycast ? frontRaycast.hitDistance : Infinity;
    const leftDistance = leftRaycast ? leftRaycast.hitDistance : Infinity;
    const rightDistance = rightRaycast ? rightRaycast.hitDistance : Infinity;
    const frontLeftDistance = Math.min(frontDistance, leftDistance);
    const frontRightDistance = Math.min(frontDistance, rightDistance);
    const minDistance = Math.min(
      frontDistance,
      leftDistance,
      rightDistance,
      frontLeftDistance,
      frontRightDistance
    );
    return {
      frontDistance,
      leftDistance,
      rightDistance,
      frontLeftDistance,
      frontRightDistance,
      minDistance,
    };
  }

  private analyzeHorseDistance(): DirectionalDistance {
    const nearbyHorses = this.raceEnv.nearbyHorses;
    const distances = this.raceEnv.nearbyHorses.distances;
    let frontDistance = Infinity;
    let leftDistance = Infinity;
    let rightDistance = Infinity;
    if (nearbyHorses.front) {
      frontDistance = distances[nearbyHorses.front.horseId];
    }
    if (nearbyHorses.left) {
      leftDistance = distances[nearbyHorses.left.horseId];
    }
    if (nearbyHorses.right) {
      rightDistance = distances[nearbyHorses.right.horseId];
    }
    const frontLeftDistance = Math.min(frontDistance, leftDistance);
    const frontRightDistance = Math.min(frontDistance, rightDistance);
    const minDistance = Math.min(frontDistance, leftDistance, rightDistance);
    return {
      frontDistance,
      leftDistance,
      rightDistance,
      frontLeftDistance,
      frontRightDistance,
      minDistance,
    };
  }

  private analyzeSpeedDistance(): DirectionalDistance {
    const currentSpeed = this.raceEnv.selfStatus.speed;
    const maxSpeed = this.horse.maxSpeed;
    const speedRatio = currentSpeed / maxSpeed;
    const baseRequiredDistance = 20;
    const speedMultiplier = 1 + speedRatio * 5;
    const stamina = this.raceEnv.selfStatus.stamina;
    const staminaRatio = stamina / this.horse.maxStamina;
    let staminaMultiplier = 1.0;
    if (staminaRatio < 0.2) {
      staminaMultiplier = 1.5;
    } else if (staminaRatio < 0.5) {
      staminaMultiplier = 1.2;
    }
    const requiredSafeDistance =
      baseRequiredDistance * speedMultiplier * staminaMultiplier;
    return {
      frontDistance: requiredSafeDistance * 1.5,
      leftDistance: requiredSafeDistance,
      rightDistance: requiredSafeDistance,
      frontLeftDistance: requiredSafeDistance * 1.2,
      frontRightDistance: requiredSafeDistance * 1.2,
      minDistance: requiredSafeDistance,
    };
  }

  private analyzeCornerDistance(): DirectionalDistance {
    const cornerApproach = this.raceEnv.trackInfo.cornerApproach;
    if (Math.abs(cornerApproach) < 0.1) {
      return {
        frontDistance: Infinity,
        leftDistance: Infinity,
        rightDistance: Infinity,
        frontLeftDistance: Infinity,
        frontRightDistance: Infinity,
        minDistance: Infinity,
      };
    }
    const intensity = Math.abs(cornerApproach);
    const currentSpeed = this.raceEnv.selfStatus.speed;
    const maxSpeed = this.horse.maxSpeed;
    const speedFactor = currentSpeed / maxSpeed;
    const baseCornerSafeDistance = 30;
    const requiredDistance =
      baseCornerSafeDistance * (1 + intensity * 2) * (1 + speedFactor);
    if (cornerApproach > 0) {
      return {
        frontDistance: requiredDistance * 0.8,
        leftDistance: requiredDistance * 1.5,
        rightDistance: requiredDistance * 0.7,
        frontLeftDistance: requiredDistance * 1.3,
        frontRightDistance: requiredDistance * 0.6,
        minDistance: requiredDistance * 0.6,
      };
    } else {
      return {
        frontDistance: requiredDistance * 0.8,
        leftDistance: requiredDistance * 0.7,
        rightDistance: requiredDistance * 1.5,
        frontLeftDistance: requiredDistance * 0.6,
        frontRightDistance: requiredDistance * 1.3,
        minDistance: requiredDistance * 0.6,
      };
    }
  }
}
