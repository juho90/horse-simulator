import { createCornerFromSegment, RaceCorner } from "./raceCorner";
import { createHorizontalLine, createLineFromSegment } from "./raceLine";
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

export function createTrack(
  totalLength: number,
  segmentCount: number
): RaceTrack {
  if (segmentCount < 2) {
    throw new Error("segmentCount는 2 이상이어야 합니다.");
  }
  const segments: RaceSegment[] = [];
  const straightRatio = 0.6;
  const cornerRatio = 0.4;
  const estimatedStraights = Math.ceil(segmentCount * 0.5);
  const estimatedCorners = segmentCount - estimatedStraights;
  const straightLength = (totalLength * straightRatio) / estimatedStraights;
  const arcLength = (totalLength * cornerRatio) / estimatedCorners;
  const totalRequiredAngle = 2 * Math.PI;
  const cornerAngles: number[] = [];
  for (let i = 0; i < estimatedCorners; i++) {
    cornerAngles.push(Math.PI * (0.3 + Math.random() * 1.4));
  }
  const currentAngleSum = cornerAngles.reduce((sum, angle) => sum + angle, 0);
  const angleScale = totalRequiredAngle / currentAngleSum;
  cornerAngles.forEach((angle, index) => {
    cornerAngles[index] = angle * angleScale;
  });
  const firstLine = createHorizontalLine(straightLength);
  segments.push(firstLine);
  let currentSegment: RaceSegment = firstLine;
  let cornerIndex = 0;
  for (let i = 1; i < segmentCount; i++) {
    const useDoubleCorner = Math.random() < 0.3;

    if (currentSegment.type === "line") {
      if (cornerIndex < cornerAngles.length) {
        const corner = createCornerFromSegment(
          currentSegment,
          arcLength,
          cornerAngles[cornerIndex]
        );
        segments.push(corner);
        currentSegment = corner;
        cornerIndex++;
        if (
          useDoubleCorner &&
          i + 1 < segmentCount &&
          cornerIndex < cornerAngles.length
        ) {
          i++;
          const secondCorner = createCornerFromSegment(
            currentSegment,
            arcLength,
            cornerAngles[cornerIndex]
          );
          segments.push(secondCorner);
          currentSegment = secondCorner;
          cornerIndex++;
        }
      }
    } else if (currentSegment.type === "corner") {
      if (Math.random() < 0.7) {
        const line = createLineFromSegment(currentSegment, straightLength);
        segments.push(line);
        currentSegment = line;
      } else {
        if (cornerIndex < cornerAngles.length) {
          const corner = createCornerFromSegment(
            currentSegment,
            arcLength,
            cornerAngles[cornerIndex]
          );
          segments.push(corner);
          currentSegment = corner;
          cornerIndex++;
        }
      }
    }
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
  let totalAngle = 0;
  for (const segment of segments) {
    if (segment.type !== "corner") {
      continue;
    }
    const corner = segment as RaceCorner;
    totalAngle += Math.abs(corner.angle);
  }
  console.log(`총 곡선 각도: ${(totalAngle * 180) / Math.PI}도 (목표: 360도)`);
  return new RaceTrack(width, height, segments);
}
