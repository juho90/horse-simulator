export interface DirectionalDistance {
  frontDistance: number;
  leftDistance: number;
  rightDistance: number;
  frontLeftDistance: number;
  frontRightDistance: number;
  minDistance: number;
}

export interface DistanceAnalysisDetail {
  wallDistance: DirectionalDistance;
  horseDistance: DirectionalDistance;
  speedAdjustedDistance: DirectionalDistance;
  cornerDistance: DirectionalDistance;
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
  static findDistance(values: DistanceValue[]): DistanceValue {
    let source: DistanceSource = DistanceSource.Unknown;
    let distance = Infinity;
    for (const value of values) {
      if (value.distance < distance) {
        distance = value.distance;
        source = value.source;
      }
    }
    return { source, distance: distance };
  }

  static combineDirectionalDistance(
    analysisDetail: DistanceAnalysisDetail
  ): DirectionalDistanceWithSource {
    const frontDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.frontDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.frontDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.frontDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.frontDistance,
      },
    ]);
    const leftDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.leftDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.leftDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.leftDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.leftDistance,
      },
    ]);
    const rightDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.rightDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.rightDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.rightDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.rightDistance,
      },
    ]);
    const frontLeftDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.frontLeftDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.frontLeftDistance,
      },
    ]);
    const frontRightDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.frontRightDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.frontRightDistance,
      },
    ]);
    const minDistance = DirectionalDistanceUtils.findDistance([
      {
        source: DistanceSource.Wall,
        distance: analysisDetail.wallDistance.minDistance,
      },
      {
        source: DistanceSource.Horse,
        distance: analysisDetail.horseDistance.minDistance,
      },
      {
        source: DistanceSource.Speed,
        distance: analysisDetail.speedAdjustedDistance.minDistance,
      },
      {
        source: DistanceSource.Corner,
        distance: analysisDetail.cornerDistance.minDistance,
      },
    ]);
    return {
      front: frontDistance,
      left: leftDistance,
      right: rightDistance,
      frontLeft: frontLeftDistance,
      frontRight: frontRightDistance,
      minValue: minDistance,
    };
  }
}
