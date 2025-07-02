import { RaceCorner } from "./raceCorner";
import { NextSegmentBuilder } from "./raceNextSegment";
import { Point, RaceSegment } from "./raceSegment";

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

  getTrackPoints(resolution: number = 2000): Point[] {
    if (this.segments.length === 0 || this.totalLength === 0) {
      return [];
    }
    const points: Point[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const segRes = Math.max(
        2,
        Math.round(resolution * (seg.length / this.totalLength))
      );
      const segPoints = seg.getPoints(segRes);
      if (i === 0) {
        points.push(...segPoints);
      } else {
        points.push(...segPoints.slice(1));
      }
    }
    return points;
  }
}

export function generateTrackPattern(segmentCount: number) {
  const segmentPattern: ("line" | "corner")[] = [];
  let lineCount = 0;
  let cornerCount = 0;
  let needsLine = true;
  for (let i = 0; i < segmentCount; i++) {
    if (needsLine) {
      segmentPattern.push("line");
      lineCount++;
      needsLine = false;
    } else {
      segmentPattern.push("corner");
      cornerCount++;
      needsLine = true;
    }
  }
  if (segmentPattern[segmentPattern.length - 1] === segmentPattern[0]) {
    if (segmentPattern[segmentPattern.length - 1] === "line") {
      segmentPattern.push("corner");
      cornerCount++;
    } else {
      segmentPattern.push("line");
      lineCount++;
    }
  }
  return { segmentPattern, lineCount, cornerCount };
}

export function createTrack(
  trackLength: number,
  segmentCount: number
): RaceTrack {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  const { segmentPattern, lineCount, cornerCount } =
    generateTrackPattern(segmentCount);
  if (lineCount === 0 || cornerCount === 0) {
    throw new Error("직선과 곡선이 모두 있어야 합니다.");
  }
  const totalLength = Math.round(trackLength / 100) * 100;
  let remainAngle = Math.PI * 2;
  let remainLength = totalLength;
  const trackStartPoint: Point = { x: 0, y: 0 };

  const segmentBuilder = new NextSegmentBuilder()
    .setSegmentType("line")
    .setTrackStartPoint(trackStartPoint)
    .setSegmentPattern(segmentPattern)
    .setSegmentIndex(0)
    .setRemainTrackLength(remainLength)
    .setRemainAngle(remainAngle);

  let currentSegment = segmentBuilder.build();
  const segments: RaceSegment[] = [];
  segments.push(currentSegment);
  remainLength -= currentSegment.length;
  for (let index = 1; index < segmentPattern.length; index++) {
    currentSegment = segmentBuilder
      .setSegmentType(segmentPattern[index])
      .setSegmentIndex(index)
      .setRemainTrackLength(remainLength)
      .setRemainAngle(remainAngle)
      .setPreviousSegment(currentSegment)
      .build();
    segments.push(currentSegment);
    remainLength -= currentSegment.length;
    if (currentSegment.type === "corner") {
      remainAngle -= (currentSegment as RaceCorner).angle;
    }
  }
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const startPoint = firstSegment.start;
  const endPoint = lastSegment.end;
  const closureDistance = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) +
      Math.pow(endPoint.y - startPoint.y, 2)
  );
  if (closureDistance > 10) {
    console.warn(
      `트랙 닫힘 거리: ${closureDistance.toFixed(
        2
      )}m - 조정이 필요할 수 있습니다.`
    );
  }
  const allX: number[] = [];
  const allY: number[] = [];
  segments.forEach((segment) => {
    const bounds = segment.getBounds();
    allX.push(bounds.minX, bounds.maxX);
    allY.push(bounds.minY, bounds.maxY);
  });
  const width = Math.max(...allX) - Math.min(...allX);
  const height = Math.max(...allY) - Math.min(...allY);
  return new RaceTrack(width, height, segments);
}
