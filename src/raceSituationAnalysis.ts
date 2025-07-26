import {
  convertHorseDistance,
  convertWallDistance,
  createDefaultDistanceWithSources,
  DirectionType,
  DistanceSource,
  DistanceValue,
  HorseDistanceValue,
  WallDistanceValue,
} from "./directionalDistance";
import { DrivingMode } from "./drivingMode";
import { FIRST_LANE, LAST_LANE, RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";

export enum RacePhase {
  Early = "early",
  Middle = "middle",
  Late = "late",
  Final = "final",
}

export class RaceSituationAnalysis {
  wallDistances: Record<DirectionType, WallDistanceValue>;
  horseDistances: Record<DirectionType, HorseDistanceValue>;
  distanceWithSources: Record<DirectionType, DistanceValue>;
  racePhase: RacePhase;
  enableDirections: DirectionType[];
  enableDrivingModes: DrivingMode[];

  constructor(private horse: RaceHorse, private raceEnv: RaceEnvironment) {
    this.wallDistances = convertWallDistance(
      this.horse,
      this.raceEnv.closestRaycasts
    );
    this.horseDistances = convertHorseDistance(
      this.horse,
      this.raceEnv.otherHorses
    );
    this.distanceWithSources = createDefaultDistanceWithSources();
    this.racePhase = RacePhase.Early;
    this.enableDirections = [];
    this.enableDrivingModes = [DrivingMode.MaintainingPace];
  }

  update(): void {
    this.updateDirectionalDistance();
    this.racePhase = this.determineRacePhase();
    this.enableDirections = this.calculateOpenDirections();
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
        distance: this.distanceWithSources.front.distance,
      },
      {
        direction: DirectionType.LEFT,
        distance: this.distanceWithSources.left.distance,
      },
      {
        direction: DirectionType.RIGHT,
        distance: this.distanceWithSources.right.distance,
      },
      {
        direction: DirectionType.FRONT_LEFT,
        distance: this.distanceWithSources.frontLeft.distance,
      },
      {
        direction: DirectionType.FRONT_RIGHT,
        distance: this.distanceWithSources.frontRight.distance,
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
      this.horseDistances[DirectionType.FRONT].distance < 30 &&
      this.horseDistances[DirectionType.LEFT].distance > 20
    );
    const canMoveInner =
      this.raceEnv.currentCourseLane !== FIRST_LANE &&
      this.horseDistances[DirectionType.LEFT].distance > 25;
    const canMoveOuter =
      this.raceEnv.currentCourseLane !== LAST_LANE &&
      this.horseDistances[DirectionType.RIGHT].distance > 25;
    const isBlocked = this.enableDirections.length === 0;
    const frontDistance =
      this.distanceWithSources[DirectionType.FRONT].distance;
    const isEmergency =
      isBlocked && (canMoveInner || canMoveOuter || frontDistance < 5);
    const isOvertaking =
      canOvertake &&
      !isBlocked &&
      this.horse.stamina > this.horse.maxStamina * 0.3;
    const isFinalStretch =
      this.racePhase === RacePhase.Final &&
      this.horse.stamina > this.horse.maxStamina * 0.2;
    const shouldBlock =
      !!(
        this.horseDistances[DirectionType.LEFT].horse ||
        this.horseDistances[DirectionType.RIGHT].horse
      ) && this.racePhase === RacePhase.Final;
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
    this.wallDistances = convertWallDistance(
      this.horse,
      this.raceEnv.closestRaycasts
    );
    this.horseDistances = convertHorseDistance(
      this.horse,
      this.raceEnv.otherHorses
    );
    this.distanceWithSources = this.analyzeDistanceWithSources();
    const enableDirections = new Set<DirectionType>();
    for (const [direction, wallDistance] of Object.entries(
      this.wallDistances
    )) {
      if (wallDistance.distance < this.horse.speed * 2) {
        continue;
      }
      enableDirections.add(direction as DirectionType);
    }
    for (const [direction, horseDistance] of Object.entries(
      this.horseDistances
    )) {
      if (horseDistance.distance < this.horse.speed * 2) {
        continue;
      }
      enableDirections.add(direction as DirectionType);
    }
    this.enableDirections = Array.from(enableDirections);
  }

  private analyzeDistanceWithSources(): Record<DirectionType, DistanceValue> {
    const front = minDistance([
      {
        source: DistanceSource.Wall,
        angle: this.wallDistances[DirectionType.FRONT].angle,
        distance: this.wallDistances[DirectionType.FRONT].distance,
      },
      {
        source: DistanceSource.Horse,
        angle: this.horseDistances[DirectionType.FRONT].angle,
        distance: this.horseDistances[DirectionType.FRONT].distance,
      },
    ]);
    const left = minDistance([
      {
        source: DistanceSource.Wall,
        angle: this.wallDistances[DirectionType.LEFT].angle,
        distance: this.wallDistances[DirectionType.LEFT].distance,
      },
      {
        source: DistanceSource.Horse,
        angle: this.horseDistances[DirectionType.LEFT].angle,
        distance: this.horseDistances[DirectionType.LEFT].distance,
      },
    ]);
    const right = minDistance([
      {
        source: DistanceSource.Wall,
        angle: this.wallDistances[DirectionType.RIGHT].angle,
        distance: this.wallDistances[DirectionType.RIGHT].distance,
      },
      {
        source: DistanceSource.Horse,
        angle: this.horseDistances[DirectionType.RIGHT].angle,
        distance: this.horseDistances[DirectionType.RIGHT].distance,
      },
    ]);
    const frontLeft = minDistance([
      {
        source: DistanceSource.Wall,
        angle: this.wallDistances[DirectionType.FRONT_LEFT].angle,
        distance: this.wallDistances[DirectionType.FRONT_LEFT].distance,
      },
      {
        source: DistanceSource.Horse,
        angle: this.horseDistances[DirectionType.FRONT_LEFT].angle,
        distance: this.horseDistances[DirectionType.FRONT_LEFT].distance,
      },
    ]);
    const frontRight = minDistance([
      {
        source: DistanceSource.Wall,
        angle: this.wallDistances[DirectionType.FRONT_RIGHT].angle,
        distance: this.wallDistances[DirectionType.FRONT_RIGHT].distance,
      },
      {
        source: DistanceSource.Horse,
        angle: this.horseDistances[DirectionType.FRONT_RIGHT].angle,
        distance: this.horseDistances[DirectionType.FRONT_RIGHT].distance,
      },
    ]);
    return {
      [DirectionType.FRONT]: front,
      [DirectionType.LEFT]: left,
      [DirectionType.RIGHT]: right,
      [DirectionType.FRONT_LEFT]: frontLeft,
      [DirectionType.FRONT_RIGHT]: frontRight,
    };
  }
}

function minDistance(values: DistanceValue[]): DistanceValue {
  let source: DistanceSource = DistanceSource.Unknown;
  let angle = 0;
  let distance = Infinity;
  for (const value of values) {
    if (value.distance < distance) {
      source = value.source;
      angle = value.angle;
      distance = value.distance;
    }
  }
  return { source, angle, distance };
}
