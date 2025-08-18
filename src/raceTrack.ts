import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceLine } from "./raceLine";
import { RaceSegment } from "./raceSegment";
import { generateClosedTrackSegments } from "./raceTrackHelper";

export class RaceTrack {
  private segments: RaceSegment[];
  private trackLength: number;
  private raceLength: number;

  constructor(segments: RaceSegment[], raceLength: number | null = null) {
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
    this.segments = segments;
    this.trackLength = trackLength;
    this.raceLength = raceLength;
  }

  getTrackLength(): number {
    return this.trackLength;
  }

  getRaceLength(): number {
    return this.raceLength;
  }

  getSegmentsLength(): number {
    return this.segments.length;
  }

  isLastSpurt(raceHorse: RaceHorse): boolean {
    const raceLength =
      this.getTrackLength() * raceHorse.lap +
      this.getTrackLength() * raceHorse.progress;
    return raceLength >= this.getRaceLength() * 0.8;
  }

  isFinished(raceHorse: RaceHorse): boolean {
    const raceLength =
      this.getTrackLength() * raceHorse.lap +
      this.getTrackLength() * raceHorse.progress;
    return raceLength >= this.getRaceLength();
  }

  getSegments(): RaceSegment[] {
    return this.segments;
  }

  getSegment(index: number): RaceSegment {
    if (index < 0 || this.segments.length <= index) {
      throw new Error(`${index}번째 세그먼트 인덱스가 범위를 벗어났습니다.`);
    }
    return this.segments[index];
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

  calcTrackBounds(
    marginX: number,
    marginY: number
  ): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } {
    const segments = this.segments;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    segments.forEach((seg) => {
      const b = seg.getBounds();
      if (b.minX < minX) {
        minX = b.minX;
      }
      if (b.maxX > maxX) {
        maxX = b.maxX;
      }
      if (b.minY < minY) {
        minY = b.minY;
      }
      if (b.maxY > maxY) {
        maxY = b.maxY;
      }
    });
    const trackWidth = 160;
    minX -= trackWidth + marginX;
    maxX += trackWidth + marginX;
    minY -= trackWidth + marginY;
    maxY += trackWidth + marginY;
    const width = maxX - minX;
    const height = maxY - minY;
    return { minX, maxX, minY, maxY, width, height };
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
  return new RaceTrack(segmentPattern);
}

export function convertTrackForRace(raceTrack: { segments: RaceSegment[] }) {
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
  return new RaceTrack(raceSegments);
}
