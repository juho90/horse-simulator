import { RaceHorse } from "./raceHorse";
import { CalculateDirection, Distance, NormalizeAngle } from "./raceMath";
import { findNearRaycast, GuardrailType, RaycastResult } from "./raceSegment";

export enum DirectionType {
  FRONT = "front",
  LEFT = "left",
  RIGHT = "right",
  FRONT_LEFT = "frontLeft",
  FRONT_RIGHT = "frontRight",
}

export enum DistanceSource {
  Wall = "wall",
  Horse = "horse",
  Unknown = "unknown",
}

export interface DistanceValue {
  source: DistanceSource;
  distance: number;
}

export function createDefaultDistanceWithSources(): Record<
  DirectionType,
  DistanceValue
> {
  return {
    [DirectionType.FRONT]: {
      source: DistanceSource.Unknown,
      distance: Infinity,
    },
    [DirectionType.LEFT]: {
      source: DistanceSource.Unknown,
      distance: Infinity,
    },
    [DirectionType.RIGHT]: {
      source: DistanceSource.Unknown,
      distance: Infinity,
    },
    [DirectionType.FRONT_LEFT]: {
      source: DistanceSource.Unknown,
      distance: Infinity,
    },
    [DirectionType.FRONT_RIGHT]: {
      source: DistanceSource.Unknown,
      distance: Infinity,
    },
  };
}

export interface WallDistanceValue {
  guardrailType: GuardrailType;
  distance: number;
}

export function convertWallDistance(
  horse: RaceHorse,
  raycasts: RaycastResult[]
): Record<DirectionType, WallDistanceValue> {
  if (!raycasts || raycasts.length === 0) {
    return {
      [DirectionType.FRONT]: {
        guardrailType: GuardrailType.Inner,
        distance: Infinity,
      },
      [DirectionType.LEFT]: {
        guardrailType: GuardrailType.Inner,
        distance: Infinity,
      },
      [DirectionType.RIGHT]: {
        guardrailType: GuardrailType.Inner,
        distance: Infinity,
      },
      [DirectionType.FRONT_LEFT]: {
        guardrailType: GuardrailType.Inner,
        distance: Infinity,
      },
      [DirectionType.FRONT_RIGHT]: {
        guardrailType: GuardrailType.Inner,
        distance: Infinity,
      },
    };
  }
  const currentHeading = horse.raceHeading;
  const directionAngles = {
    front: NormalizeAngle(currentHeading),
    left: NormalizeAngle(currentHeading - Math.PI / 2),
    right: NormalizeAngle(currentHeading + Math.PI / 2),
    frontLeft: NormalizeAngle(currentHeading - Math.PI / 4),
    frontRight: NormalizeAngle(currentHeading + Math.PI / 4),
  };
  const frontRaycast = findNearRaycast(directionAngles.front, raycasts);
  const leftRaycast = findNearRaycast(directionAngles.left, raycasts);
  const rightRaycast = findNearRaycast(directionAngles.right, raycasts);
  const frontLeftRaycast = findNearRaycast(directionAngles.frontLeft, raycasts);
  const frontRightRaycast = findNearRaycast(
    directionAngles.frontRight,
    raycasts
  );
  return {
    [DirectionType.FRONT]: {
      guardrailType: frontRaycast?.guardrailType ?? GuardrailType.Inner,
      distance: frontRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.LEFT]: {
      guardrailType: leftRaycast?.guardrailType ?? GuardrailType.Inner,
      distance: leftRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.RIGHT]: {
      guardrailType: rightRaycast?.guardrailType ?? GuardrailType.Inner,
      distance: rightRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.FRONT_LEFT]: {
      guardrailType: frontLeftRaycast?.guardrailType ?? GuardrailType.Inner,
      distance: frontLeftRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.FRONT_RIGHT]: {
      guardrailType: frontRightRaycast?.guardrailType ?? GuardrailType.Inner,
      distance: frontRightRaycast?.hitDistance ?? Infinity,
    },
  };
}

export interface HorseDistanceValue {
  horse: RaceHorse | null;
  angle: number | null;
  distance: number;
}

export function convertHorseDistance(
  horse: RaceHorse,
  otherHorses: RaceHorse[]
): Record<DirectionType, HorseDistanceValue> {
  const horseDistances: Record<DirectionType, HorseDistanceValue> = {
    [DirectionType.FRONT]: { horse: null, angle: 0, distance: Infinity },
    [DirectionType.LEFT]: { horse: null, angle: 0, distance: Infinity },
    [DirectionType.RIGHT]: { horse: null, angle: 0, distance: Infinity },
    [DirectionType.FRONT_LEFT]: { horse: null, angle: 0, distance: Infinity },
    [DirectionType.FRONT_RIGHT]: { horse: null, angle: 0, distance: Infinity },
  };
  for (const otherHorse of otherHorses) {
    if (otherHorse.horseId === horse.horseId) {
      continue;
    }
    const distance = Distance(otherHorse, horse);
    if (horse.speed * 3 < distance) {
      continue;
    }
    const { direction, angle } = CalculateDirection(
      horse,
      otherHorse,
      horse.raceHeading
    );
    if (!direction) {
      continue;
    }
    const before = horseDistances[direction];
    if (!before.horse || distance < before.distance) {
      horseDistances[direction] = { horse: otherHorse, angle, distance };
    }
  }
  return horseDistances;
}
