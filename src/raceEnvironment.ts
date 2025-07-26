import { RaceHorse } from "./raceHorse";
import { Distance } from "./raceMath";
import { raycastBoundary, RaycastResult, TRACK_WIDTH } from "./raceSegment";

export const FIRST_LANE = 1;
export const LAST_LANE = 17;

export class RaceEnvironment {
  closestRaycasts: RaycastResult[];
  otherHorses: RaceHorse[];
  raceProgress: number;
  currentRank: number;
  currentCourseLane: number;

  constructor(private horse: RaceHorse) {
    this.closestRaycasts = [];
    this.otherHorses = [];
    this.raceProgress = 0;
    this.currentRank = 1;
    this.currentCourseLane = this.calculateCourseCurrentLane();
  }

  update(otherHorses: RaceHorse[]): void {
    this.otherHorses = otherHorses;
    this.updateRaycast();
    this.raceProgress = this.calculateRaceProgress();
    this.currentRank = this.calculateCurrentRank(otherHorses);
    this.currentCourseLane = this.calculateCourseCurrentLane();
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

  private calculateCourseCurrentLane(): number {
    const segment = this.horse.segment;
    const progressAt = segment.getProgressAt(this.horse.x, this.horse.y);
    const ortho = segment.getOrthoVectorAt(progressAt.x, progressAt.y);
    const trackWidthAt = {
      x: progressAt.x + ortho.x * TRACK_WIDTH,
      y: progressAt.y + ortho.y * TRACK_WIDTH,
    };
    const leftDistance = Distance(this.horse, progressAt);
    const rightDistance = Distance(this.horse, trackWidthAt);
    const totalWidth = leftDistance + rightDistance;
    const positionRatio = leftDistance / totalWidth;
    return Math.max(
      FIRST_LANE,
      Math.min(LAST_LANE, Math.round(positionRatio * LAST_LANE))
    );
  }
}
