export enum DirectionType {
  FRONT = "front",
  LEFT = "left",
  RIGHT = "right",
  FRONT_LEFT = "frontLeft",
  FRONT_RIGHT = "frontRight",
}

export interface DirectionalDistance {
  frontDistance: number;
  leftDistance: number;
  rightDistance: number;
  frontLeftDistance: number;
  frontRightDistance: number;
  minDistance: number;
}

export enum DistanceSource {
  Wall = "wall",
  Horse = "horse",
  Speed = "speed",
  Corner = "corner",
  Combined = "combined",
  Unknown = "unknown",
}

export interface DistanceValue {
  source: DistanceSource;
  distance: number;
}

export interface DirectionalDistanceWithSource {
  front: DistanceValue;
  left: DistanceValue;
  right: DistanceValue;
  frontLeft: DistanceValue;
  frontRight: DistanceValue;
  minValue: DistanceValue;
}

export class DirectionalDistanceUtils {
  static createDefaultDirectionalDistance(): DirectionalDistance {
    return {
      frontDistance: Infinity,
      leftDistance: Infinity,
      rightDistance: Infinity,
      frontLeftDistance: Infinity,
      frontRightDistance: Infinity,
      minDistance: Infinity,
    };
  }

  static createDefaultDirectionalDistanceWithSource(): DirectionalDistanceWithSource {
    return {
      front: { source: DistanceSource.Unknown, distance: Infinity },
      left: { source: DistanceSource.Unknown, distance: Infinity },
      right: { source: DistanceSource.Unknown, distance: Infinity },
      frontLeft: { source: DistanceSource.Unknown, distance: Infinity },
      frontRight: { source: DistanceSource.Unknown, distance: Infinity },
      minValue: { source: DistanceSource.Unknown, distance: Infinity },
    };
  }
}
