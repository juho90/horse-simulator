import { Lane } from "./laneEvaluation";
import { RaceHorse } from "./raceHorse";
import { raycastBoundary, RaycastResult } from "./raceSegment";

export class RaceEnvironment {
  closestRaycasts: RaycastResult[];
  otherHorses: RaceHorse[];
  raceProgress: number;
  currentRank: number;
  currentLane: Lane;

  constructor(private horse: RaceHorse) {
    this.closestRaycasts = [];
    this.otherHorses = [];
    this.raceProgress = 0;
    this.currentRank = 1;
    this.currentLane = Lane.Middle;
  }

  update(otherHorses: RaceHorse[]): void {
    this.otherHorses = otherHorses;
    this.updateRaycast();
    this.raceProgress = this.calculateRaceProgress();
    this.currentRank = this.calculateCurrentRank(otherHorses);
    this.currentLane = this.getCurrentLane();
  }

  private updateRaycast(): void {
    const nextSegmentIndex =
      (this.horse.segmentIndex + 1) % this.horse.segments.length;
    const nextSegment = this.horse.segments[nextSegmentIndex];
    const closestRaycasts = raycastBoundary(
      this.horse.x,
      this.horse.y,
      this.horse.raceHeading,
      this.horse.segment,
      nextSegment
    );
    this.closestRaycasts = closestRaycasts;
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
}
