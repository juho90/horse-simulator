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
import { Lerp, OuterGuardrail, ProjectOnSegment, Vector2D } from "./raceMath";
import { RaceSegment } from "./raceSegment";

export const LINE_LENGTHS = [300, 350, 400, 450];
export const CORNER_ANGLES = [Math.PI / 4, Math.PI / 3, Math.PI / 2];
export const CORNER_RADIUS = [250, 275, 300, 325];

export interface RaceTrackHint {
  type: "line" | "corner";
  length?: number;
  radius?: number;
  angle?: number;
}

export function generateTrackPatternClosed(
  segmentCount: number
): RaceTrackHint[] {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  const pattern: RaceTrackHint[] = [];
  let remainAngle = 2 * Math.PI;
  let cornerCount = Math.floor((segmentCount - 2) / 2) + 1;
  let lineCount = segmentCount - cornerCount;
  pattern.push({
    type: "line",
    length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
  });
  for (let i = 1; i < segmentCount - 1; i++) {
    if (pattern[pattern.length - 1].type === "line") {
      let angle =
        CORNER_ANGLES[Math.floor(Math.random() * CORNER_ANGLES.length)];
      if (cornerCount === 1) angle = remainAngle;
      angle = Math.max(
        Math.min(angle, Math.max(...CORNER_ANGLES)),
        Math.min(...CORNER_ANGLES)
      );
      const radius =
        CORNER_RADIUS[Math.floor(Math.random() * CORNER_RADIUS.length)];
      pattern.push({ type: "corner", radius, angle });
      remainAngle -= angle;
      cornerCount--;
    } else {
      pattern.push({
        type: "line",
        length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
      });
      lineCount--;
    }
  }
  if (pattern[pattern.length - 1].type !== "line") {
    pattern.push({
      type: "line",
      length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
    });
  }
  for (let i = pattern.length - 2; i > 0; i--) {
    if (pattern[i].type === "corner" && remainAngle > 1e-6) {
      const maxAdditionalAngle = Math.PI / 2;
      const additionalAngle = Math.min(remainAngle, maxAdditionalAngle);
      pattern[i].angle = (pattern[i].angle ?? 0) + additionalAngle;
      remainAngle -= additionalAngle;
      if (remainAngle <= 1e-6) break;
    }
  }
  if (remainAngle > 1e-6) {
    const numSmallCorners = Math.ceil(remainAngle / (Math.PI / 6));
    const smallAngle = remainAngle / numSmallCorners;
    for (let j = 0; j < numSmallCorners && remainAngle > 1e-6; j++) {
      for (let i = pattern.length - 2; i > 0; i--) {
        if (pattern[i].type === "corner" && remainAngle > 1e-6) {
          const currentAngle = pattern[i].angle ?? 0;
          const maxTotal = Math.PI;
          if (currentAngle < maxTotal) {
            const addAngle = Math.min(
              smallAngle,
              maxTotal - currentAngle,
              remainAngle
            );
            pattern[i].angle = currentAngle + addAngle;
            remainAngle -= addAngle;
          }
        }
      }
    }
  }
  const getTotalAngle = () => {
    return pattern.reduce((total, seg) => {
      return seg.type === "corner" ? total + (seg.angle ?? 0) : total;
    }, 0);
  };
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === "line" && pattern[i - 1].type === "line") {
      const currentTotal = getTotalAngle();
      const availableAngle = 2 * Math.PI - currentTotal;
      if (availableAngle > Math.PI / 6) {
        const newAngle = Math.min(
          CORNER_ANGLES[Math.floor(Math.random() * CORNER_ANGLES.length)],
          availableAngle
        );
        pattern[i - 1] = {
          type: "corner",
          radius:
            CORNER_RADIUS[Math.floor(Math.random() * CORNER_RADIUS.length)],
          angle: newAngle,
        };
      }
    }
  }
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === "corner" && pattern[i - 1].type === "corner") {
      pattern[i] = {
        type: "line",
        length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
      };
    }
  }
  for (let i = 0; i < pattern.length; i++) {
    const prev = pattern[(i - 1 + pattern.length) % pattern.length];
    const curr = pattern[i];
    const next = pattern[(i + 1) % pattern.length];
    if (
      prev.type === "corner" &&
      curr.type === "corner" &&
      next.type === "corner"
    ) {
      curr.type = "line";
      curr.length =
        LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)];
      delete curr.radius;
      delete curr.angle;
    }
  }
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === "corner" && pattern[i - 1].type === "corner") {
      pattern[i] = {
        type: "line",
        length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
      };
    }
  }
  if (pattern[0].type !== "line") {
    pattern[0] = {
      type: "line",
      length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
    };
  }
  const finalTotalAngle = getTotalAngle();
  if (finalTotalAngle > 2 * Math.PI + 1e-6) {
    const scaleFactor = (2 * Math.PI) / finalTotalAngle;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].type === "corner" && pattern[i].angle) {
        pattern[i].angle = pattern[i].angle! * scaleFactor;
      }
    }
  }
  return pattern;
}

export function generateClosedTrackSegments(
  segmentCount: number
): RaceSegment[] {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  const pattern = generateTrackPatternClosed(segmentCount);
  const segments: RaceSegment[] = [];
  let prevSegment: RaceSegment | null = null;
  for (let i = 0; i < pattern.length - 2; i++) {
    const hint = pattern[i];
    if (hint.type === "line") {
      let segment: RaceSegment;
      if (prevSegment) {
        segment = createLineFromSegment(prevSegment, hint.length!);
      } else {
        segment = createHorizontalLine(hint.length!);
      }
      segments.push(segment);
      prevSegment = segment;
    } else {
      const angle = hint.angle!;
      const radius = hint.radius!;
      let segment: RaceSegment;
      if (prevSegment) {
        segment = createCornerFromSegment(prevSegment, radius, angle);
      } else {
        segment = createHorizontalCorner(radius, angle);
      }
      segments.push(segment);
      prevSegment = segment;
    }
  }
  const preLast = segments[segments.length - 1];
  const startPt = segments[0].start;
  const startDir = segments[0].getEndTangentDirection();
  let bestErr = Infinity;
  let bestCorner: RaceCorner | null = null;
  let bestLine: RaceLine | null = null;
  const lastHint = pattern[pattern.length - 2];
  const firstIsLine = pattern[0].type === "line";
  for (let dAngle = -0.5; dAngle <= 0.5; dAngle += 0.01) {
    for (let dRadius = -50; dRadius <= 50; dRadius += 5) {
      const angle = (lastHint.angle ?? Math.PI / 4) + dAngle;
      const radius = (lastHint.radius ?? 100) + dRadius;
      if (radius < 30) {
        continue;
      }
      const corner = createCornerFromSegment(preLast, radius, angle);
      const line = new RaceLine(corner.end, startPt);
      const tangentErr = Math.abs(
        ((line.getEndTangentDirection() - startDir + Math.PI) % (2 * Math.PI)) -
          Math.PI
      );
      const posErr = Math.hypot(line.end.x - startPt.x, line.end.y - startPt.y);
      const totalErr = firstIsLine ? posErr + tangentErr * 10000 : posErr;
      if (totalErr < bestErr) {
        bestErr = totalErr;
        bestCorner = corner;
        bestLine = line;
        if (firstIsLine && tangentErr < 1e-4 && posErr < 1e-2) {
          break;
        }
        if (!firstIsLine && posErr < 1e-2) {
          break;
        }
      }
    }
    if (
      bestLine &&
      ((firstIsLine &&
        Math.abs(
          ((bestLine.getEndTangentDirection() - startDir + Math.PI) %
            (2 * Math.PI)) -
            Math.PI
        ) < 1e-4) ||
        (!firstIsLine && bestErr < 1e-2))
    ) {
      break;
    }
  }
  if (bestCorner && bestLine) {
    segments.push(bestCorner);
    const exactDistance = Math.hypot(
      bestCorner.end.x - startPt.x,
      bestCorner.end.y - startPt.y
    );
    const finalLine = new RaceLine(bestCorner.end, startPt);
    if (Math.abs(finalLine.length - exactDistance) > 1e-6) {
      finalLine.length = exactDistance;
    }
    segments.push(finalLine);
  } else {
    const angle = lastHint.angle ?? Math.PI / 4;
    const radius = lastHint.radius ?? 100;
    const corner = createCornerFromSegment(preLast, radius, angle);
    const exactDistance = Math.hypot(
      corner.end.x - startPt.x,
      corner.end.y - startPt.y
    );
    const finalLine = new RaceLine(corner.end, startPt);
    if (Math.abs(finalLine.length - exactDistance) > 1e-6) {
      finalLine.length = exactDistance;
    }
    segments.push(corner);
    segments.push(finalLine);
  }
  return segments;
}

export class RaceTrackHelper {
  innerPoints: Vector2D[];
  outerPoints: Vector2D[];
  constructor(innerPoints: Vector2D[], outerOffset: number) {
    this.innerPoints = innerPoints;
    this.outerPoints = OuterGuardrail(innerPoints, outerOffset);
  }

  getLateralPosition(idx: number, laneRatio: number): Vector2D {
    return Lerp(this.innerPoints[idx], this.outerPoints[idx], laneRatio);
  }

  getDirection(idx: number): number {
    return RaceTrackHelper.Direction(this.innerPoints, idx);
  }

  getLateralDirection(idx: number): number {
    return RaceTrackHelper.Direction(
      [this.innerPoints[idx], this.outerPoints[idx]],
      0
    );
  }

  static Direction(arr: Vector2D[], idx: number): number {
    const a = arr[idx],
      b = arr[(idx + 1) % arr.length];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  clampToBoundary(x: number, y: number): Vector2D {
    return RaceTrackHelper.clampToTrackBoundary(
      x,
      y,
      this.innerPoints,
      this.outerPoints
    );
  }

  static clampToTrackBoundary(
    x: number,
    y: number,
    innerPoints: Vector2D[],
    outerPoints: Vector2D[]
  ): Vector2D {
    let minDist = Infinity,
      closestIdx = 0;
    for (let i = 0; i < innerPoints.length; i++) {
      const d = (x - innerPoints[i].x) ** 2 + (y - innerPoints[i].y) ** 2;
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    const i1 = closestIdx,
      i2 = (closestIdx + 1) % innerPoints.length;
    const in1 = innerPoints[i1],
      in2 = innerPoints[i2];
    const out1 = outerPoints[i1],
      out2 = outerPoints[i2];
    const t = ProjectOnSegment(x, y, in1, in2);
    const innerProj = Lerp(in1, in2, t);
    const outerProj = Lerp(out1, out2, t);
    const proj = ProjectOnSegment(x, y, innerProj, outerProj);
    return Lerp(innerProj, outerProj, proj);
  }
}
