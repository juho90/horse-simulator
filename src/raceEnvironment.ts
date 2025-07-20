import { Lane } from "./laneEvaluation";
import { RaceHorse } from "./raceHorse";
import { Distance } from "./raceMath";
import { RaycastResult, raycastBoundary } from "./raceSimulator";

export enum RelativePosition {
  Front = "front",
  Left = "left",
  Right = "right",
  Back = "back",
}

export interface NearbyHorse {
  front: RaceHorse | null;
  left: RaceHorse | null;
  right: RaceHorse | null;
  distances: { [horseId: number]: number };
}

export class RaceEnvironment {
  trackInfo: {
    raycasts: RaycastResult[];
    cornerApproach: number;
    currentLane: Lane;
  };
  nearbyHorses: NearbyHorse;
  selfStatus: {
    speed: number;
    stamina: number;
    raceProgress: number;
    currentRank: number;
  };
  closestRaycasts: RaycastResult[] | null = null;
  farthestRaycast: RaycastResult | null = null;

  constructor(private horse: RaceHorse) {
    this.nearbyHorses = { front: null, left: null, right: null, distances: {} };
    this.trackInfo = {
      raycasts: [],
      cornerApproach: 0,
      currentLane: Lane.Middle,
    };
    this.selfStatus = { speed: 0, stamina: 0, raceProgress: 0, currentRank: 1 };
  }

  update(otherHorses: RaceHorse[]): void {
    this.nearbyHorses = this.findNearbyHorses(otherHorses);
    this.trackInfo = this.collectTrackInfo();
    this.selfStatus = this.collectSelfStatus(otherHorses);
  }

  private findNearbyHorses(otherHorses: RaceHorse[]): NearbyHorse {
    const nearby: NearbyHorse = {
      front: null,
      left: null,
      right: null,
      distances: {},
    };
    for (const other of otherHorses) {
      if (other.horseId === this.horse.horseId) {
        continue;
      }
      const distance = Distance(other, this.horse);
      nearby.distances[other.horseId] = distance;
      if (distance < 50) {
        const position = this.getRelativePosition(other);
        if (
          position === RelativePosition.Front &&
          (!nearby.front || distance < Distance(nearby.front, this.horse))
        ) {
          nearby.front = other;
        } else if (
          position === RelativePosition.Left &&
          (!nearby.left || distance < Distance(nearby.left, this.horse))
        ) {
          nearby.left = other;
        } else if (
          position === RelativePosition.Right &&
          (!nearby.right || distance < Distance(nearby.right, this.horse))
        ) {
          nearby.right = other;
        }
      }
    }
    return nearby;
  }

  private getRelativePosition(other: RaceHorse): RelativePosition {
    const dx = other.x - this.horse.x;
    const dy = other.y - this.horse.y;
    const angle = Math.atan2(dy, dx);
    const relativeAngle = angle - this.horse.raceHeading;
    const normalizedAngle =
      ((relativeAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (normalizedAngle < Math.PI / 4 || normalizedAngle > (7 * Math.PI) / 4) {
      return RelativePosition.Front;
    }
    if (normalizedAngle < (3 * Math.PI) / 4) {
      return RelativePosition.Left;
    }
    if (normalizedAngle < (5 * Math.PI) / 4) {
      return RelativePosition.Back;
    }
    return RelativePosition.Right;
  }

  private collectTrackInfo() {
    this.updateRaycast();
    return {
      raycasts: this.closestRaycasts || [],
      cornerApproach: this.calculateCornerApproach(),
      currentLane: this.getCurrentLane(),
    };
  }

  private updateRaycast(): void {
    const nextSegmentIndex =
      (this.horse.segmentIndex + 1) % this.horse.segments.length;
    const nextSegment = this.horse.segments[nextSegmentIndex];
    const { closestRaycasts, farthestRaycast } = raycastBoundary(
      this.horse.x,
      this.horse.y,
      this.horse.raceHeading,
      this.horse.segment,
      nextSegment
    );
    this.closestRaycasts = closestRaycasts;
    this.farthestRaycast = farthestRaycast;
  }

  private calculateCornerApproach(): number {
    return this.horse.segment.getTangentDirectionAt(this.horse.x, this.horse.y);
  }

  private getCurrentLane(): Lane {
    if (this.closestRaycasts && this.closestRaycasts.length > 0) {
      const leftRaycast = this.closestRaycasts.find(
        (raycast) =>
          Math.abs(raycast.rayAngle - (this.horse.raceHeading - Math.PI / 2)) <
          0.1
      );
      const rightRaycast = this.closestRaycasts.find(
        (raycast) =>
          Math.abs(raycast.rayAngle - (this.horse.raceHeading + Math.PI / 2)) <
          0.1
      );
      if (leftRaycast && rightRaycast) {
        const leftDistance = leftRaycast.hitDistance;
        const rightDistance = rightRaycast.hitDistance;
        const totalWidth = leftDistance + rightDistance;
        const positionRatio = leftDistance / totalWidth;
        if (positionRatio <= 0.33) {
          return Lane.Inner;
        } else if (positionRatio >= 0.67) {
          return Lane.Outer;
        } else {
          return Lane.Middle;
        }
      }
    }
    const distanceFromInner = Math.abs(this.horse.gate - 0);
    const distanceFromOuter = Math.abs(this.horse.gate - 7);
    if (distanceFromInner <= 2) {
      return Lane.Inner;
    }
    if (distanceFromOuter <= 2) {
      return Lane.Outer;
    }
    return Lane.Middle;
  }

  private collectSelfStatus(otherHorses: RaceHorse[]) {
    return {
      speed: this.horse.speed,
      stamina: this.horse.stamina,
      raceProgress: this.calculateRaceProgress(),
      currentRank: this.calculateCurrentRank(otherHorses),
    };
  }

  private calculateRaceProgress(): number {
    const totalDistance = this.horse.segments.reduce(
      (sum, seg) => sum + seg.length,
      0
    );
    return Math.min(1, this.horse.raceDistance / totalDistance);
  }

  private calculateCurrentRank(otherHorses: RaceHorse[]): number {
    let rank = 1;
    const myDistance = this.horse.raceDistance;
    for (const other of otherHorses) {
      if (other.raceDistance > myDistance) {
        rank++;
      }
    }
    return rank;
  }
}
