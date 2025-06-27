import { createCornerFromSegment } from "./raceCorner";
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
    this.segments.forEach((seg) => {
      seg.length = Math.round(seg.length / 50) * 50;
    });
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

export function generateValidTrack(
  segmentCount: number,
  randomAngles: boolean = true
) {
  const segmentPattern: ("line" | "corner")[] = [];
  let needsLine = true;
  for (let i = 0; i < segmentCount; i++) {
    if (needsLine) {
      segmentPattern.push("line");
      needsLine = false;
    } else {
      segmentPattern.push("corner");
      needsLine = true;
    }
  }
  if (segmentPattern[segmentPattern.length - 1] === segmentPattern[0]) {
    if (segmentPattern[segmentPattern.length - 1] === "line") {
      segmentPattern.push("corner");
    } else {
      segmentPattern.push("line");
    }
  }
  const cornerCount = segmentPattern.filter((s) => s === "corner").length;

  const cornerAngles: number[] = [];

  if (randomAngles && cornerCount > 1) {
    const weights: number[] = [];
    for (let i = 0; i < cornerCount; i++) {
      weights.push(Math.random() + 0.1);
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < cornerCount; i++) {
      cornerAngles.push((weights[i] / totalWeight) * 2 * Math.PI);
    }
  } else {
    const equalAngle = (2 * Math.PI) / cornerCount;
    for (let i = 0; i < cornerCount; i++) {
      cornerAngles.push(equalAngle);
    }
  }
  return { segmentPattern, cornerAngles };
}

export function createTrack(
  totalLength: number,
  segmentCount: number,
  useRandomLengths: boolean = false,
  useRandomAngles: boolean = false
): RaceTrack {
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다.");
  }
  totalLength = Math.round(totalLength / 100) * 100;
  const { segmentPattern, cornerAngles } = generateValidTrack(
    segmentCount,
    useRandomAngles
  );
  const lineCount = segmentPattern.filter((s) => s === "line").length;
  const cornerCount = segmentPattern.filter((s) => s === "corner").length;
  if (lineCount === 0 || cornerCount === 0) {
    throw new Error("직선과 곡선이 모두 있어야 합니다.");
  }
  let straightLengths: number[] = [];
  let arcLengths: number[] = [];
  if (useRandomLengths) {
    const straightTotalLength = Math.round((totalLength * 0.6) / 50) * 50;
    const arcTotalLength = Math.round((totalLength * 0.4) / 50) * 50;
    for (let i = 0; i < lineCount; i++) {
      const randomFactor = 0.5 + Math.random();
      straightLengths.push(randomFactor);
    }
    const straightSum = straightLengths.reduce((sum, val) => sum + val, 0);
    straightLengths = straightLengths.map(
      (val) => Math.round(((val / straightSum) * straightTotalLength) / 50) * 50
    );
    let straightActualSum = straightLengths.reduce((sum, val) => sum + val, 0);
    let diff = straightTotalLength - straightActualSum;
    while (diff !== 0) {
      const idx = Math.floor(Math.random() * lineCount);
      if (diff > 0) {
        straightLengths[idx] += 50;
        diff -= 50;
      } else {
        if (straightLengths[idx] > 50) {
          straightLengths[idx] -= 50;
          diff += 50;
        }
      }
    }
    for (let i = 0; i < cornerCount; i++) {
      const randomFactor = 0.5 + Math.random();
      arcLengths.push(randomFactor);
    }
    const arcSum = arcLengths.reduce((sum, val) => sum + val, 0);
    arcLengths = arcLengths.map(
      (val) => Math.round(((val / arcSum) * arcTotalLength) / 50) * 50
    );
    let arcActualSum = arcLengths.reduce((sum, val) => sum + val, 0);
    diff = arcTotalLength - arcActualSum;
    while (diff !== 0) {
      const idx = Math.floor(Math.random() * cornerCount);
      if (diff > 0) {
        arcLengths[idx] += 50;
        diff -= 50;
      } else {
        if (arcLengths[idx] > 50) {
          arcLengths[idx] -= 50;
          diff += 50;
        }
      }
    }
    const adjustedTotal = straightTotalLength + arcTotalLength;
    if (adjustedTotal !== totalLength) {
      totalLength = adjustedTotal;
    }
  } else {
    const straightLength =
      Math.round((totalLength * 0.6) / lineCount / 50) * 50;
    const arcLength = Math.round((totalLength * 0.4) / cornerCount / 50) * 50;
    straightLengths = Array(lineCount).fill(straightLength);
    arcLengths = Array(cornerCount).fill(arcLength);
    const actualTotal = straightLength * lineCount + arcLength * cornerCount;
    if (actualTotal !== totalLength) {
      totalLength = actualTotal;
    }
  }
  const segments: RaceSegment[] = [];
  let currentSegment: RaceSegment | null = null;
  let lineIndex = 0;
  let cornerIndex = 0;
  let remainingAngle = cornerAngles.reduce((sum, angle) => sum + angle, 0);
  for (let i = 0; i < segmentPattern.length; i++) {
    const segmentType = segmentPattern[i];
    if (i === 0) {
      const length = straightLengths[lineIndex];
      currentSegment = createHorizontalLine(length);
      segments.push(currentSegment);
      lineIndex++;
    } else {
      const startPoint = currentSegment!.end;

      if (segmentType === "line") {
        const length = straightLengths[lineIndex];
        currentSegment = createNextSegment(
          startPoint,
          currentSegment!,
          length,
          remainingAngle,
          "line"
        );
        segments.push(currentSegment);
        lineIndex++;
      } else {
        const angle = cornerAngles[cornerIndex];
        const arcLength = arcLengths[cornerIndex];
        currentSegment = createNextSegment(
          startPoint,
          currentSegment!,
          arcLength,
          remainingAngle,
          "corner"
        );
        segments.push(currentSegment);
        remainingAngle -= angle;
        cornerIndex++;
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

  return new RaceTrack(width, height, segments);
}

export function createNextSegment(
  startPoint: Point,
  previousSegment: RaceSegment,
  segmentLength: number,
  remainingAngle: number,
  segmentType: "line" | "corner"
): RaceSegment {
  if (segmentType === "corner" && remainingAngle > 0) {
    const cornerAngle = Math.min(Math.PI / 2, remainingAngle);
    return createCornerFromSegment(previousSegment, segmentLength, cornerAngle);
  } else {
    return createLineFromSegment(previousSegment, segmentLength);
  }
}
