import { RaceHorse } from "./raceHorse";
import { RaceSegment } from "./raceSegment";
import { generateClosedTrackSegments } from "./raceTrackHelper";

export class RaceTrack {
  width: number;
  height: number;
  segments: RaceSegment[];
  trackLength: number;
  raceLength: number;
  totalLaps: number;
  private goalSegmentIndex: number;
  private goalSegmentProgress: number;

  constructor(
    width: number,
    height: number,
    segments: RaceSegment[],
    raceLength: number | null = null
  ) {
    this.width = width;
    this.height = height;
    this.segments = segments;
    this.trackLength = this.segments.reduce((sum, seg) => sum + seg.length, 0);
    if (raceLength === null) {
      const minMultiplier = 0.8;
      const maxMultiplier = 2.0;
      const randomMultiplier =
        minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
      this.raceLength =
        Math.round((this.trackLength * randomMultiplier) / 100) * 100;
    } else {
      this.raceLength = raceLength;
    }
    const totalLaps = Math.floor(this.raceLength / this.trackLength);
    this.totalLaps = totalLaps;
    const remainingDistance = this.raceLength % this.trackLength;
    let goalSegmentIndex = 0;
    let goalSegmentProgress = 0;
    let accumulatedLength = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const segmentLength = this.segments[i].length;
      if (accumulatedLength + segmentLength >= remainingDistance) {
        goalSegmentIndex = i;
        goalSegmentProgress = remainingDistance - accumulatedLength;
        break;
      }
      accumulatedLength += segmentLength;
    }
    this.goalSegmentIndex = goalSegmentIndex;
    this.goalSegmentProgress = goalSegmentProgress;
  }

  getFirstSegment(): RaceSegment {
    if (this.segments.length === 0) {
      throw new Error("트랙에 세그먼트가 없습니다.");
    }
    return this.segments[0];
  }

  getLastSegment(): RaceSegment {
    if (this.segments.length === 0) {
      throw new Error("트랙에 세그먼트가 없습니다.");
    }
    return this.segments[this.segments.length - 1];
  }

  isGoal(horse: RaceHorse): boolean {
    const hasCompletedRequiredLaps = horse.lap >= this.totalLaps;
    const isInTargetSegment = horse.segmentIndex === this.goalSegmentIndex;
    if (hasCompletedRequiredLaps && isInTargetSegment) {
      const currentPositionInSegment = horse.segment.getProgress(
        horse.x,
        horse.y
      );
      if (currentPositionInSegment >= this.goalSegmentProgress) {
        return true;
      }
    }
    return false;
  }
}

export function createTrack(segmentCount: number): RaceTrack {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  const segmentPattern = generateClosedTrackSegments(segmentCount);
  const allX: number[] = [];
  const allY: number[] = [];
  segmentPattern.forEach((segment) => {
    const bounds = segment.getBounds();
    allX.push(bounds.minX, bounds.maxX);
    allY.push(bounds.minY, bounds.maxY);
  });
  const width = Math.max(...allX) - Math.min(...allX) + 200;
  const height = Math.max(...allY) - Math.min(...allY) + 200;
  return new RaceTrack(width, height, segmentPattern);
}
