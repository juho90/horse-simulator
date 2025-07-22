import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceLine } from "./raceLine";
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
        const distanceIntoSegment = remainingDistance - accumulatedLength;
        goalSegmentProgress = distanceIntoSegment / segmentLength;
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

  getTrackProgress(segmentIndex: number, x: number, y: number): number {
    let totalLength = 0;
    for (let i = 0; i < segmentIndex; i++) {
      totalLength += this.segments[i].length;
    }
    const segment = this.segments[segmentIndex];
    const segmentProgress = segment.getProgress(x, y);
    totalLength += segment.length * segmentProgress;
    return totalLength / this.trackLength;
  }

  getRaceProgress(
    lap: number,
    segmentIndex: number,
    x: number,
    y: number
  ): number {
    const trackProgress = this.getTrackProgress(segmentIndex, x, y);
    const totalLength =
      lap * this.trackLength + trackProgress * this.trackLength;
    return totalLength / this.raceLength;
  }

  getGoalPosition(): { x: number; y: number } {
    const goalSegment = this.segments[this.goalSegmentIndex];
    if (goalSegment.type === "line") {
      const startX = goalSegment.start.x;
      const startY = goalSegment.start.y;
      const endX = goalSegment.end.x;
      const endY = goalSegment.end.y;
      return {
        x: startX + (endX - startX) * this.goalSegmentProgress,
        y: startY + (endY - startY) * this.goalSegmentProgress,
      };
    } else {
      const corner = goalSegment as RaceCorner;
      const totalAngle = Math.abs(corner.angle);
      const currentAngle =
        corner.startAngle + totalAngle * this.goalSegmentProgress;
      return {
        x: corner.center.x + corner.radius * Math.cos(currentAngle),
        y: corner.center.y + corner.radius * Math.sin(currentAngle),
      };
    }
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

export function convertTrackForRace(raceTrack: {
  width: number;
  height: number;
  segments: RaceSegment[];
}) {
  const raceSegments = new Array<RaceSegment>(raceTrack.segments.length);
  for (let index = 0; index < raceTrack.segments.length; index++) {
    const parseSegment = raceTrack.segments[index] as RaceSegment;
    if (parseSegment.type === "line") {
      const lineSegment = parseSegment as RaceLine;
      raceSegments[index] = new RaceLine(lineSegment.start, lineSegment.end);
    } else {
      const cornerSegment = parseSegment as RaceCorner;
      raceSegments[index] = new RaceCorner(
        cornerSegment.start,
        cornerSegment.center,
        cornerSegment.radius,
        cornerSegment.angle
      );
    }
  }
  return new RaceTrack(raceTrack.width, raceTrack.height, raceSegments);
}
