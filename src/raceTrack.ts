import { RaceCorner } from "./raceCorner";
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

  constructor(
    width: number,
    height: number,
    segments: RaceSegment[],
    raceLength: number | null = null
  ) {
    let trackLength = 0;
    for (const segment of segments) {
      trackLength += segment.length;
    }
    let cumulativeLength = 0;
    for (const segment of segments) {
      segment.setCumulativeProgress(cumulativeLength / trackLength);
      cumulativeLength += segment.length;
    }
    if (raceLength === null) {
      const minMultiplier = 0.8;
      const maxMultiplier = 2.0;
      const randomMultiplier = Math.random() * (maxMultiplier - minMultiplier);
      const calcRaceLength = trackLength * (minMultiplier + randomMultiplier);
      raceLength = Math.round(calcRaceLength / 100) * 100;
    }
    const totalLaps = Math.floor(raceLength / trackLength);
    this.width = width;
    this.height = height;
    this.segments = segments;
    this.trackLength = trackLength;
    this.raceLength = raceLength;
    this.totalLaps = totalLaps;
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

  getSegment(index: number): RaceSegment {
    if (index < 0 || index >= this.segments.length) {
      throw new Error("세그먼트 인덱스가 범위를 벗어났습니다.");
    }
    return this.segments[index];
  }

  getGoalPosition(): { x: number; y: number } {
    let goalSegmentIndex = 0;
    let goalSegmentProgress = 0;
    let accumulatedLength = 0;
    const remainingDistance = this.raceLength % this.trackLength;
    for (let index = 0; index < this.segments.length; index++) {
      const segmentLength = this.segments[index].length;
      if (accumulatedLength + segmentLength >= remainingDistance) {
        goalSegmentIndex = index;
        const distanceIntoSegment = remainingDistance - accumulatedLength;
        goalSegmentProgress = distanceIntoSegment / segmentLength;
        break;
      }
      accumulatedLength += segmentLength;
    }
    const goalSegment = this.segments[goalSegmentIndex];
    if (goalSegment.type === "line") {
      const startX = goalSegment.start.x;
      const startY = goalSegment.start.y;
      const endX = goalSegment.end.x;
      const endY = goalSegment.end.y;
      return {
        x: startX + (endX - startX) * goalSegmentProgress,
        y: startY + (endY - startY) * goalSegmentProgress,
      };
    } else {
      const corner = goalSegment as RaceCorner;
      const totalAngle = Math.abs(corner.angle);
      const currentAngle = corner.startAngle + totalAngle * goalSegmentProgress;
      return {
        x: corner.center.x + corner.radius * Math.cos(currentAngle),
        y: corner.center.y + corner.radius * Math.sin(currentAngle),
      };
    }
  }

  getTrackProgress(segmentIndex: number, x: number, y: number): number {
    const segment = this.segments[segmentIndex];
    const segmentProgress = segment.getProgress(x, y);
    return segment.getCumulativeProgress() + segmentProgress;
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
      raceSegments[index] = new RaceLine(
        index,
        lineSegment.start,
        lineSegment.end
      );
    } else {
      const cornerSegment = parseSegment as RaceCorner;
      raceSegments[index] = new RaceCorner(
        index,
        cornerSegment.start,
        cornerSegment.center,
        cornerSegment.radius,
        cornerSegment.angle
      );
    }
  }
  return new RaceTrack(raceTrack.width, raceTrack.height, raceSegments);
}
