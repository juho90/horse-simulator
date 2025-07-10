import { RaceSegment } from "./raceSegment";
import { generateClosedTrackSegments } from "./raceTrackHelper";

export class RaceTrack {
  width: number;
  height: number;
  segments: RaceSegment[];
  totalLength: number;

  constructor(width: number, height: number, segments: RaceSegment[]) {
    this.width = width;
    this.height = height;
    this.segments = segments;
    this.totalLength = this.segments.reduce((sum, seg) => sum + seg.length, 0);
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
