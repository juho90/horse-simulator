import { RaceHorse } from "./raceHorse";
import { NormalizeAngle } from "./raceMath";
import { GuardrailType } from "./raceSegment";

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

export interface HorseDistanceValue {
  horse: RaceHorse | null;
  angle: number;
  distance: number;
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
