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

export const DIRECTIONS = [
  DirectionType.FRONT,
  DirectionType.LEFT,
  DirectionType.RIGHT,
  DirectionType.FRONT_LEFT,
  DirectionType.FRONT_RIGHT,
];

export enum DistanceSource {
  Wall = "wall",
  Horse = "horse",
  Unknown = "unknown",
}

export interface DistanceValue {
  source: DistanceSource;
  angle: number;
  distance: number;
}

export function createDefaultDistanceWithSources(): Record<
  DirectionType,
  DistanceValue
> {
  return {
    [DirectionType.FRONT]: {
      source: DistanceSource.Unknown,
      angle: convertDirectionToAngle(DirectionType.FRONT),
      distance: Infinity,
    },
    [DirectionType.LEFT]: {
      source: DistanceSource.Unknown,
      angle: convertDirectionToAngle(DirectionType.LEFT),
      distance: Infinity,
    },
    [DirectionType.RIGHT]: {
      source: DistanceSource.Unknown,
      angle: convertDirectionToAngle(DirectionType.RIGHT),
      distance: Infinity,
    },
    [DirectionType.FRONT_LEFT]: {
      source: DistanceSource.Unknown,
      angle: convertDirectionToAngle(DirectionType.FRONT_LEFT),
      distance: Infinity,
    },
    [DirectionType.FRONT_RIGHT]: {
      source: DistanceSource.Unknown,
      angle: convertDirectionToAngle(DirectionType.FRONT_RIGHT),
      distance: Infinity,
    },
  };
}

export interface WallDistanceValue {
  guardrailType: GuardrailType;
  angle: number;
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
        angle: 0,
        distance: Infinity,
      },
      [DirectionType.LEFT]: {
        guardrailType: GuardrailType.Inner,
        angle: Math.PI / 2,
        distance: Infinity,
      },
      [DirectionType.RIGHT]: {
        guardrailType: GuardrailType.Inner,
        angle: -Math.PI / 2,
        distance: Infinity,
      },
      [DirectionType.FRONT_LEFT]: {
        guardrailType: GuardrailType.Inner,
        angle: Math.PI / 4,
        distance: Infinity,
      },
      [DirectionType.FRONT_RIGHT]: {
        guardrailType: GuardrailType.Inner,
        angle: -Math.PI / 4,
        distance: Infinity,
      },
    };
  }
  const currentHeading = horse.raceHeading;
  const front = NormalizeAngle(currentHeading);
  const left = NormalizeAngle(
    currentHeading + convertDirectionToAngle(DirectionType.LEFT)
  );
  const right = NormalizeAngle(
    currentHeading - convertDirectionToAngle(DirectionType.RIGHT)
  );
  const frontLeft = NormalizeAngle(
    currentHeading + convertDirectionToAngle(DirectionType.FRONT_LEFT)
  );
  const frontRight = NormalizeAngle(
    currentHeading - convertDirectionToAngle(DirectionType.FRONT_RIGHT)
  );
  const frontRaycast = findNearRaycast(front, raycasts);
  const leftRaycast = findNearRaycast(left, raycasts);
  const rightRaycast = findNearRaycast(right, raycasts);
  const frontLeftRaycast = findNearRaycast(frontLeft, raycasts);
  const frontRightRaycast = findNearRaycast(frontRight, raycasts);
  return {
    [DirectionType.FRONT]: {
      guardrailType: frontRaycast?.guardrailType ?? GuardrailType.Inner,
      angle: front,
      distance: frontRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.LEFT]: {
      guardrailType: leftRaycast?.guardrailType ?? GuardrailType.Inner,
      angle: left,
      distance: leftRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.RIGHT]: {
      guardrailType: rightRaycast?.guardrailType ?? GuardrailType.Inner,
      angle: right,
      distance: rightRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.FRONT_LEFT]: {
      guardrailType: frontLeftRaycast?.guardrailType ?? GuardrailType.Inner,
      angle: frontLeft,
      distance: frontLeftRaycast?.hitDistance ?? Infinity,
    },
    [DirectionType.FRONT_RIGHT]: {
      guardrailType: frontRightRaycast?.guardrailType ?? GuardrailType.Inner,
      angle: frontRight,
      distance: frontRightRaycast?.hitDistance ?? Infinity,
    },
  };
}

export interface HorseDistanceValue {
  horse: RaceHorse | null;
  angle: number;
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

export function convertDirectionToAngle(directionType: DirectionType): number {
  switch (directionType) {
    case DirectionType.FRONT:
      return 0;
    case DirectionType.LEFT: // 위
      return -Math.PI / 2;
    case DirectionType.RIGHT: // 아래
      return Math.PI / 2;
    case DirectionType.FRONT_LEFT:
      return -Math.PI / 4;
    case DirectionType.FRONT_RIGHT:
      return Math.PI / 4;
    default:
      return 0;
  }
}

export function addDirectionToAngle(
  angle: number,
  directionType: DirectionType
): number {
  return NormalizeAngle(angle + convertDirectionToAngle(directionType));
}

export function convertAngleToDirection(angle: number): DirectionType | null {
  let normalAngle = NormalizeAngle(angle);
  if (Math.PI < normalAngle) {
    normalAngle -= 2 * Math.PI;
  }
  const pi10 = Math.PI / 10;
  if (normalAngle >= -pi10 && normalAngle < pi10) {
    return DirectionType.FRONT;
  }
  if (normalAngle >= pi10 && normalAngle < 3 * pi10) {
    return DirectionType.FRONT_RIGHT;
  }
  if (normalAngle >= 3 * pi10 && normalAngle < 5 * pi10) {
    return DirectionType.RIGHT;
  }
  if (normalAngle <= -pi10 && normalAngle > -3 * pi10) {
    return DirectionType.FRONT_LEFT;
  }
  if (normalAngle <= -3 * pi10 && normalAngle >= -5 * pi10) {
    return DirectionType.LEFT;
  }
  return null;
}
