import {
  createCornerFromSegment,
  createHorizontalCorner,
  RaceCorner,
} from "./raceCorner";
import {
  createHorizontalLine,
  createLineFromSegment,
  RaceLine,
} from "./raceLine";
import { Point, RaceSegment } from "./raceSegment";

export const LINE_LENGTHS = [300, 350, 400, 450];
export const CORNER_ANGLES = [Math.PI / 6, Math.PI / 4, Math.PI / 2];
export const CORNER_RADIUS = [50, 100, 150, 200];

export interface RaceTrackHint {
  type: "line" | "corner";
  length?: number;
  radius?: number;
  angle?: number;
}

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

export function generateTrackPattern(segmentCount: number): RaceTrackHint[] {
  const segmentPattern: RaceTrackHint[] = [];
  let remainAngle = 2 * Math.PI;
  let needsLine = true;
  for (let i = 0; i < segmentCount; i++) {
    if (needsLine) {
      const length =
        LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)];
      segmentPattern.push({ type: "line", length: length });
      needsLine = false;
    } else {
      const radius =
        CORNER_RADIUS[Math.floor(Math.random() * CORNER_RADIUS.length)];
      segmentPattern.push({ type: "corner", radius: radius });
      needsLine = true;
    }
  }
  if (segmentPattern[segmentPattern.length - 1] === segmentPattern[0]) {
    if (segmentPattern[segmentPattern.length - 1].type === "line") {
      const radius =
        CORNER_RADIUS[Math.floor(Math.random() * CORNER_RADIUS.length)];
      segmentPattern.push({ type: "corner", radius: radius });
    } else {
      segmentPattern.push({ type: "line" });
    }
  }
  const cornerHitnts = segmentPattern.filter((hint) => hint.type === "corner");
  const cornerCount = cornerHitnts.length;
  let cornerIndex = 0;
  for (const cornerHitnt of cornerHitnts) {
    if (cornerIndex === cornerCount - 1) {
      cornerHitnt.angle = remainAngle;
    } else {
      // 남은 각도에서 최소 각도만큼은 남겨둬야 함
      const minRemain =
        (cornerCount - cornerIndex - 1) * Math.min(...CORNER_ANGLES);
      const candidates = CORNER_ANGLES.filter(
        (a) => a <= remainAngle - minRemain
      );
      const angle =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : Math.min(...CORNER_ANGLES);
      cornerHitnt.angle = angle;
      remainAngle -= angle;
    }
    cornerIndex++;
  }
  return segmentPattern;
}

export function adjustRaceSegments(segments: RaceSegment[]): RaceSegment[] {
  if (segments.length < 2) {
    return segments;
  }
  const N = segments.length;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const dx = first.start.x - last.end.x;
  const dy = first.start.y - last.end.y;
  const adjustX = dx / N;
  const adjustY = dy / N;
  const minLength = 150;
  let currDir = 0;
  let remainingAdjust = 0;
  let prevSegment: RaceSegment | null = null;
  const adjusted: RaceSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const adjust = Math.cos(currDir) * adjustX + Math.sin(currDir) * adjustY;
    if (seg.type === "line") {
      const lineSeg = seg as RaceLine;
      if (lineSeg.length + adjust < minLength) {
        remainingAdjust += adjust;
        const newSeg: RaceSegment = prevSegment
          ? createLineFromSegment(prevSegment, lineSeg.length)
          : createHorizontalLine(lineSeg.length);
        adjusted.push(newSeg);
        prevSegment = newSeg;
        currDir = newSeg.getDirection();
        continue;
      } else {
        let newLength = lineSeg.length + adjust + remainingAdjust;
        if (newLength < minLength) {
          const remainAdjust = minLength - newLength;
          newLength = minLength;
          remainingAdjust = remainAdjust;
        } else {
          remainingAdjust = 0;
        }
        const newSeg: RaceSegment = prevSegment
          ? createLineFromSegment(prevSegment, newLength)
          : createHorizontalLine(newLength);
        adjusted.push(newSeg);
        prevSegment = newSeg;
        currDir = newSeg.getDirection();
      }
    } else {
      const cornerSeg = seg as RaceCorner;
      if (cornerSeg.length + adjust < minLength) {
        remainingAdjust += adjust;
        const angle = cornerSeg.angle;
        const radius = cornerSeg.radius;
        const newSeg: RaceSegment = prevSegment
          ? createCornerFromSegment(prevSegment, radius, angle)
          : createHorizontalCorner(radius, angle);
        adjusted.push(newSeg);
        prevSegment = newSeg;
        currDir = newSeg.getDirection();
      } else {
        let newLength = cornerSeg.length + adjust + remainingAdjust;
        if (newLength < minLength) {
          const remainAdjust = minLength - newLength;
          newLength = minLength;
          remainingAdjust = remainAdjust;
        } else {
          remainingAdjust = 0;
        }
        const angle = cornerSeg.angle;
        const radius = newLength / Math.abs(angle);
        const newSeg: RaceSegment = prevSegment
          ? createCornerFromSegment(prevSegment, radius, angle)
          : createHorizontalCorner(radius, angle);
        adjusted.push(newSeg);
        prevSegment = newSeg;
        currDir = newSeg.getDirection();
      }
    }
  }
  return adjusted;
}

export function createTrack(segmentCount: number): RaceTrack {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  const segmentPattern = generateTrackPattern(segmentCount);
  const segments: RaceSegment[] = [];
  let prevSegment: RaceSegment | null = null;
  for (const segmentHint of segmentPattern) {
    if (segmentHint.type === "line") {
      const length = segmentHint.length!;
      const segment: RaceSegment = prevSegment
        ? createLineFromSegment(prevSegment, length)
        : createHorizontalLine(length);
      segments.push(segment);
      prevSegment = segment;
    } else {
      const angle = segmentHint.angle!;
      const radius = segmentHint.radius!;
      const segment: RaceSegment = prevSegment
        ? createCornerFromSegment(prevSegment, radius, angle)
        : createHorizontalCorner(radius, angle);
      segments.push(segment);
      prevSegment = segment;
    }
  }
  const adjustSegments = adjustRaceSegments(segments);
  const firstSegment = adjustSegments[0];
  const lastSegment = adjustSegments[adjustSegments.length - 1];
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
  adjustSegments.forEach((segment) => {
    const bounds = segment.getBounds();
    allX.push(bounds.minX, bounds.maxX);
    allY.push(bounds.minY, bounds.maxY);
  });
  const width = Math.max(...allX) - Math.min(...allX);
  const height = Math.max(...allY) - Math.min(...allY);
  return new RaceTrack(width, height, adjustSegments);
}
