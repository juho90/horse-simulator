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
import { RaceSegment } from "./raceSegment";

export const LINE_LENGTHS = [300, 350, 400, 450];
export const CORNER_ANGLES = [Math.PI / 6, Math.PI / 4, Math.PI / 2];
export const CORNER_RADIUS = [150, 200, 250, 300];

export interface RaceTrackHint {
  type: "line" | "corner";
  length?: number;
  radius?: number;
  angle?: number;
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

export function translateTrackToClose(segments: RaceSegment[]): RaceSegment[] {
  if (segments.length < 2) {
    return segments;
  }
  const first = segments[0];
  const last = segments[segments.length - 1];
  const dx = first.start.x - last.end.x;
  const dy = first.start.y - last.end.y;
  return segments.map((segment) => segment.cloneWithOffset(dx, dy));
}

export function autoAdjustLastSegmentsToClose(
  segments: RaceSegment[],
  options?: { adjustCount?: number; minLength?: number; minRadius?: number }
): RaceSegment[] {
  if (segments.length < 2) {
    return segments;
  }
  const N = segments.length;
  const adjustCount = options?.adjustCount ?? 1;
  const minLength = options?.minLength ?? 150;
  const minRadius = options?.minRadius ?? 30;
  const start = segments[0].start;
  const end = segments[N - 1].end;
  const dx = start.x - end.x;
  const dy = start.y - end.y;
  const newSegments = segments.slice();
  for (let i = N - adjustCount; i < N; i++) {
    const segment = newSegments[i];
    if (segment.type === "line") {
      const dir = segment.getDirection();
      const proj = Math.cos(dir) * dx + Math.sin(dir) * dy;
      let newLength = (segment as any).length + proj;
      if (newLength < minLength) newLength = minLength;
      newSegments[i] =
        i > 0
          ? createLineFromSegment(newSegments[i - 1], newLength)
          : createHorizontalLine(newLength);
    } else {
      const angle = (segment as any).angle;
      let radius = (segment as any).radius;
      let newRadius = Math.max(
        minRadius,
        radius + (dx + dy) / 2 / Math.abs(angle)
      );
      newSegments[i] =
        i > 0
          ? createCornerFromSegment(newSegments[i - 1], newRadius, angle)
          : createHorizontalCorner(newRadius, angle);
    }
  }
  return newSegments;
}

export function robustCloseTrack(segments: RaceSegment[]): RaceSegment[] {
  if (segments.length < 2) return segments;
  const N = segments.length;
  const first = segments[0];
  const last = segments[N - 1];
  const dx = first.start.x - last.end.x;
  const dy = first.start.y - last.end.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return segments;
  }
  let adjusted = adjustRaceSegments(segments);
  const adjLast = adjusted[adjusted.length - 1];
  const adjDx = first.start.x - adjLast.end.x;
  const adjDy = first.start.y - adjLast.end.y;
  if (Math.hypot(adjDx, adjDy) < 1e-3) {
    return adjusted;
  }
  let bestSegs = adjusted.slice();
  let minErr = Infinity;
  const prev = adjusted[N - 2];
  const lastSeg = adjusted[N - 1];
  for (let d1 = -40; d1 <= 40; d1 += 4) {
    for (let d2 = -40; d2 <= 40; d2 += 4) {
      let newPrev = prev;
      let newLast = lastSeg;
      if (prev.type === "line") {
        const len = (prev as RaceLine).length + d1;
        if (len < 100) {
          continue;
        }
        newPrev = createLineFromSegment(adjusted[N - 3], len);
      } else if (prev.type === "corner") {
        const angle = (prev as RaceCorner).angle + d1 * 0.01;
        const radius = (prev as RaceCorner).radius;
        if (Math.abs(angle) < 0.1) {
          continue;
        }
        newPrev = createCornerFromSegment(adjusted[N - 3], radius, angle);
      }
      if (lastSeg.type === "line") {
        const len = (lastSeg as RaceLine).length + d2;
        if (len < 100) {
          continue;
        }
        newLast = createLineFromSegment(newPrev, len);
      } else if (lastSeg.type === "corner") {
        const angle = (lastSeg as RaceCorner).angle + d2 * 0.01;
        const radius = (lastSeg as RaceCorner).radius;
        if (Math.abs(angle) < 0.1) {
          continue;
        }
        newLast = createCornerFromSegment(newPrev, radius, angle);
      }
      // 마지막 세그먼트는 무조건 시작점에 닫히도록 강제 생성
      if (lastSeg.type === "line") {
        // newPrev의 end에서 first.start까지 직선 생성
        newLast = new RaceLine(newPrev.end, {
          x: first.start.x,
          y: first.start.y,
        });
      } else if (lastSeg.type === "corner") {
        // newPrev의 end에서 first.start까지 반지름 유지하며 각도 자동 계산
        const radius = (lastSeg as RaceCorner).radius;
        const start = newPrev.end;
        const dx = first.start.x - start.x;
        const dy = first.start.y - start.y;
        const dist = Math.hypot(dx, dy);
        // 반지름보다 거리가 작으면, 각도는 부호 유지하며 arcLength = dist
        let angle = (lastSeg as RaceCorner).angle;
        let newAngle = angle;
        if (radius > 0.1) {
          // 호의 길이 = r * |angle|, chord = 2r * sin(|angle|/2)
          // 역산: angle = 2 * arcsin(chord / (2r))
          const chord = dist;
          newAngle = 2 * Math.asin(Math.min(1, chord / (2 * Math.abs(radius))));
          if (angle < 0) newAngle = -newAngle;
        }
        // center 계산: start에서 반지름만큼 수직 방향으로 이동
        const dir = Math.atan2(dy, dx);
        const centerAngle = dir + (newAngle > 0 ? -Math.PI / 2 : Math.PI / 2);
        const center = {
          x: start.x + radius * Math.cos(centerAngle),
          y: start.y + radius * Math.sin(centerAngle),
        };
        newLast = new RaceCorner(start, center, radius, newAngle);
      }
      const testSegs = adjusted.slice(0, N - 2).concat([newPrev, newLast]);
      const dx = first.start.x - newLast.end.x;
      const dy = first.start.y - newLast.end.y;
      const err = Math.hypot(dx, dy);
      if (err < minErr) {
        minErr = err;
        bestSegs = testSegs;
        if (err < 1e-3) {
          break;
        }
      }
    }
    if (minErr < 1e-3) {
      break;
    }
  }
  if (minErr < 1e-2) {
    return bestSegs;
  }
  // 마지막 2개 세그먼트로 시작점의 위치와 방향을 모두 맞추는 역산 보정
  // [코너, 직선] 또는 [직선, 코너] 조합만 우선 지원
  const preLast = adjusted[N - 2];
  const lastS = adjusted[N - 1];
  let closed = false;
  let fixedSegs = adjusted.slice(0, N - 2);
  // [코너, 직선] 조합
  if (preLast.type === "corner" && lastS.type === "line") {
    const corner = preLast as RaceCorner;
    const dir0 = corner.getDirection();
    const start = corner.end;
    const end = { x: first.start.x, y: first.start.y };
    // 직선 길이와 방향: start에서 end까지
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    const newLine = new RaceLine(start, end);
    // 코너 각도는 방향 연속성 보장
    const prevDir = (adjusted[N - 3] as RaceSegment).getDirection();
    const cornerDir = Math.atan2(
      start.y - corner.center.y,
      start.x - corner.center.x
    );
    const targetDir = Math.atan2(dy, dx);
    let newAngle = targetDir - prevDir;
    // 부호 보정
    if (corner.angle < 0 && newAngle > 0) newAngle -= 2 * Math.PI;
    if (corner.angle > 0 && newAngle < 0) newAngle += 2 * Math.PI;
    const newCorner = new RaceCorner(
      corner.start,
      corner.center,
      corner.radius,
      newAngle
    );
    fixedSegs = fixedSegs.concat([newCorner, newLine]);
    closed = true;
  }
  // [직선, 코너] 조합
  else if (preLast.type === "line" && lastS.type === "corner") {
    const line = preLast as RaceLine;
    const corner = lastS as RaceCorner;
    // 직선: line.start ~ line.end
    // 코너: line.end ~ ? (끝점이 first.start에 오도록)
    const start = line.end;
    const end = { x: first.start.x, y: first.start.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    // 각도 역산
    const radius = corner.radius;
    let angle = corner.angle;
    if (radius > 0.1) {
      const chord = Math.hypot(dx, dy);
      angle = 2 * Math.asin(Math.min(1, chord / (2 * Math.abs(radius))));
      if (corner.angle < 0) angle = -angle;
    }
    const dir = Math.atan2(dy, dx);
    const centerAngle = dir + (angle > 0 ? -Math.PI / 2 : Math.PI / 2);
    const center = {
      x: start.x + radius * Math.cos(centerAngle),
      y: start.y + radius * Math.sin(centerAngle),
    };
    const newCorner = new RaceCorner(start, center, radius, angle);
    fixedSegs = fixedSegs.concat([line, newCorner]);
    closed = true;
  }
  if (closed) {
    return fixedSegs;
  }
  let numericallyClosed = tryNumericalLastSegmentClosure(adjusted);
  const numLast = numericallyClosed[numericallyClosed.length - 1];
  const numDx = first.start.x - numLast.end.x;
  const numDy = first.start.y - numLast.end.y;
  if (Math.hypot(numDx, numDy) < 1e-3) {
    return numericallyClosed;
  }
  let translated = translateTrackToClose(numericallyClosed);
  return translated;
}

function tryNumericalLastSegmentClosure(
  segments: RaceSegment[]
): RaceSegment[] {
  const N = segments.length;
  if (N < 2) {
    return segments;
  }
  const first = segments[0];
  const last = segments[N - 1];
  const dx = first.start.x - last.end.x;
  const dy = first.start.y - last.end.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return segments;
  }
  const newSegments = segments.slice();
  const adjustCount = Math.min(3, N - 1);
  for (let i = N - adjustCount; i < N; i++) {
    const segment = newSegments[i];
    if (segment.type === "line") {
      const dir = segment.getDirection();
      const proj = Math.cos(dir) * dx + Math.sin(dir) * dy;
      (segment as any).length += proj;
    } else {
      const angle = (segment as any).angle;
      let radius = (segment as any).radius;
      let newRadius = radius + (dx + dy) / 2 / Math.abs(angle);
      if (newRadius < 0) newRadius = 0;
      (segment as any).radius = newRadius;
    }
  }
  return newSegments;
}

export function generateTrackPatternClosed(
  segmentCount: number
): RaceTrackHint[] {
  if (segmentCount < 3) throw new Error("segmentCount는 3 이상이어야 합니다.");
  // 항상 [line, corner, ... , corner, line] 패턴만 허용
  // 첫 세그먼트는 무조건 직선
  const pattern: RaceTrackHint[] = [];
  let remainAngle = 2 * Math.PI;
  let cornerCount = Math.floor((segmentCount - 2) / 2) + 1; // 최소 1개
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
      pattern[i].angle = (pattern[i].angle ?? 0) + remainAngle;
      break;
    }
  }
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === "line" && pattern[i - 1].type === "line") {
      pattern[i - 1] = {
        type: "corner",
        radius: CORNER_RADIUS[Math.floor(Math.random() * CORNER_RADIUS.length)],
        angle: CORNER_ANGLES[Math.floor(Math.random() * CORNER_ANGLES.length)],
      };
    }
  }
  // 첫 세그먼트가 반드시 직선인지 최종 보장
  if (pattern[0].type !== "line") {
    pattern[0] = {
      type: "line",
      length: LINE_LENGTHS[Math.floor(Math.random() * LINE_LENGTHS.length)],
    };
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
  let firstSegment: RaceSegment | null = null;
  for (let i = 0; i < pattern.length - 2; i++) {
    const hint = pattern[i];
    if (hint.type === "line") {
      let segment: RaceSegment;
      if (prevSegment) {
        segment = createLineFromSegment(prevSegment, hint.length!);
      } else {
        segment = createHorizontalLine(hint.length!);
        firstSegment = segment;
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
        firstSegment = segment;
      }
      segments.push(segment);
      prevSegment = segment;
    }
  }
  const preLast = segments[segments.length - 1];
  const startPt = segments[0].start;
  const startDir = segments[0].getDirection();
  let bestErr = Infinity;
  let bestCorner: RaceCorner | null = null;
  let bestLine: RaceLine | null = null;
  const lastHint = pattern[pattern.length - 2];
  const lastLineHint = pattern[pattern.length - 1];
  // 첫 세그먼트가 직선일 때만 방향 오차를 강하게 반영
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
        ((line.getDirection() - startDir + Math.PI) % (2 * Math.PI)) - Math.PI
      );
      const posErr = Math.hypot(line.end.x - startPt.x, line.end.y - startPt.y);
      // 첫 세그먼트가 직선이면 방향 오차에 매우 큰 가중치, 아니면 위치만
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
          ((bestLine.getDirection() - startDir + Math.PI) % (2 * Math.PI)) -
            Math.PI
        ) < 1e-4) ||
        (!firstIsLine && bestErr < 1e-2))
    ) {
      break;
    }
  }
  if (bestCorner && bestLine) {
    segments.push(bestCorner);
    segments.push(bestLine);
  } else {
    const angle = lastHint.angle ?? Math.PI / 4;
    const radius = lastHint.radius ?? 100;
    const corner = createCornerFromSegment(preLast, radius, angle);
    const line = new RaceLine(corner.end, startPt);
    segments.push(corner);
    segments.push(line);
  }
  return segments;
}
