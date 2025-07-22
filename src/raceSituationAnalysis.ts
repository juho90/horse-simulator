import {
  DirectionalDistance,
  DirectionalDistanceUtils,
  DirectionalDistanceWithSource,
  DirectionType,
  DistanceSource,
  DistanceValue,
} from "./directionalDistance";
import { DrivingMode } from "./drivingMode";
import { Lane, RacePhase } from "./laneEvaluation";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";

export class RaceSituationAnalysis {
  wallDistance: DirectionalDistance;
  horseDistance: DirectionalDistance;
  speedAdjustedDistance: DirectionalDistance;
  cornerDistance: DirectionalDistance;
  dirDistanceWithSource: DirectionalDistanceWithSource;
  racePhase: RacePhase;
  openDirections: DirectionType[] = [];
  enableDrivingModes: DrivingMode[];

  constructor(private horse: RaceHorse, private raceEnv: RaceEnvironment) {
    this.wallDistance =
      DirectionalDistanceUtils.createDefaultDirectionalDistance();
    this.horseDistance =
      DirectionalDistanceUtils.createDefaultDirectionalDistance();
    this.speedAdjustedDistance =
      DirectionalDistanceUtils.createDefaultDirectionalDistance();
    this.cornerDistance =
      DirectionalDistanceUtils.createDefaultDirectionalDistance();
    this.dirDistanceWithSource =
      DirectionalDistanceUtils.createDefaultDirectionalDistanceWithSource();
    this.racePhase = RacePhase.Early;
    this.openDirections = [];
    this.enableDrivingModes = [DrivingMode.MaintainingPace];
  }

  update(): void {
    this.updateDirectionalDistance();
    this.racePhase = this.determineRacePhase();
    this.openDirections = this.calculateOpenDirections();
    this.updateSituation();
  }

  private determineRacePhase(): RacePhase {
    const progress = this.raceEnv.raceProgress;
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

  private calculateOpenDirections(): DirectionType[] {
    const directionMap = [
      {
        direction: DirectionType.FRONT,
        distance: this.dirDistanceWithSource.front.distance,
      },
      {
        direction: DirectionType.LEFT,
        distance: this.dirDistanceWithSource.left.distance,
      },
      {
        direction: DirectionType.RIGHT,
        distance: this.dirDistanceWithSource.right.distance,
      },
      {
        direction: DirectionType.FRONT_LEFT,
        distance: this.dirDistanceWithSource.frontLeft.distance,
      },
      {
        direction: DirectionType.FRONT_RIGHT,
        distance: this.dirDistanceWithSource.frontRight.distance,
      },
    ];
    const openDirections: DirectionType[] = [];
    for (const dir of directionMap) {
      if (dir.distance > this.horse.speed) {
        openDirections.push(dir.direction);
      }
    }
    return openDirections;
  }

  private updateSituation(): void {
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
      this.raceEnv.currentLane !== Lane.Inner &&
      (!this.raceEnv.nearbyHorses.left ||
        this.raceEnv.nearbyHorses.distances[
          this.raceEnv.nearbyHorses.left.horseId
        ] > 25);
    const canMoveOuter =
      this.raceEnv.currentLane !== Lane.Outer &&
      (!this.raceEnv.nearbyHorses.right ||
        this.raceEnv.nearbyHorses.distances[
          this.raceEnv.nearbyHorses.right.horseId
        ] > 25);
    const isBlocked = this.openDirections.length === 0;
    const frontDistance = this.dirDistanceWithSource.front.distance;
    const isEmergency =
      isBlocked && (canMoveInner || canMoveOuter || frontDistance < 5);
    const isOvertaking =
      canOvertake &&
      !isBlocked &&
      this.horse.stamina > this.horse.maxStamina * 0.3;
    const isFinalStretch =
      this.racePhase === RacePhase.Final &&
      this.horse.stamina > this.horse.maxStamina * 0.2;
    const nearbyHorses = this.raceEnv.nearbyHorses;
    const shouldBlock =
      !!(nearbyHorses.left || nearbyHorses.right) && this.racePhase === "final";
    const enableDrivingModes = [DrivingMode.MaintainingPace];
    if (isEmergency) {
      enableDrivingModes.push(DrivingMode.Positioning);
    } else if (isOvertaking) {
      enableDrivingModes.push(DrivingMode.Overtaking);
    } else if (isFinalStretch) {
      enableDrivingModes.push(DrivingMode.LastSpurt);
    } else if (shouldBlock) {
      enableDrivingModes.push(DrivingMode.Positioning);
    }
    this.enableDrivingModes = enableDrivingModes;
  }

  private updateDirectionalDistance() {
    this.wallDistance = this.analyzeWallDistance();
    this.horseDistance = this.analyzeHorseDistance();
    this.speedAdjustedDistance = this.analyzeSpeedDistance();
    this.cornerDistance = this.analyzeCornerDistance();
    const frontDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.frontDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.frontDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.frontDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.frontDistance,
      },
    ]);
    const leftDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.leftDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.leftDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.leftDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.leftDistance,
      },
    ]);
    const rightDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.rightDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.rightDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.rightDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.rightDistance,
      },
    ]);
    const frontLeftDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.frontLeftDistance,
      },
    ]);
    const frontRightDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.frontRightDistance,
      },
    ]);
    const minDistance = RaceSituationAnalysis.minDistance([
      {
        source: DistanceSource.Wall,
        distance: this.wallDistance.minDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: this.horseDistance.minDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: this.speedAdjustedDistance.minDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: this.cornerDistance.minDistance,
      },
    ]);
    this.dirDistanceWithSource = {
      front: frontDistance,
      left: leftDistance,
      right: rightDistance,
      frontLeft: frontLeftDistance,
      frontRight: frontRightDistance,
      minValue: minDistance,
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
    const currentSpeed = this.horse.speed;
    const maxSpeed = this.horse.maxSpeed;
    const speedRatio = currentSpeed / maxSpeed;
    const baseRequiredDistance = 20;
    const speedMultiplier = 1 + speedRatio * 5;
    const stamina = this.horse.stamina;
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
    const cornerApproach = this.horse.segment.getTangentDirectionAt(
      this.horse.x,
      this.horse.y
    );
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
    const currentSpeed = this.horse.speed;
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

  static minDistance(values: DistanceValue[]): DistanceValue {
    let source: DistanceSource = DistanceSource.Unknown;
    let distance = Infinity;
    for (const value of values) {
      if (value.distance < distance) {
        distance = value.distance;
        source = value.source;
      }
    }
    return { source, distance };
  }
}
