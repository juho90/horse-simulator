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
  if (segmentCount < 3) {
    throw new Error("segmentCount는 3 이상이어야 합니다 (닫힌 도형을 위해).");
  }
  function generateValidTrack(segmentCount: number) {
    const segments: ("line" | "corner")[] = [];
    const cornerAngles: number[] = [];
    let needsLine = true;
    for (let i = 0; i < segmentCount; i++) {
      if (needsLine) {
        segments.push("line");
        needsLine = false;
      } else {
        segments.push("corner");
        const angle = Math.PI / 6 + Math.random() * ((5 * Math.PI) / 6);
        cornerAngles.push(angle);
        needsLine = true;
      }
    }
    if (segments[segments.length - 1] === segments[0]) {
      if (segments[segments.length - 1] === "line") {
        segments.push("corner");
        cornerAngles.push(Math.PI / 2); // 90도
      } else {
        segments.push("line");
      }
    }
    return { segments, cornerAngles };
  }
  const { segments: segmentPattern, cornerAngles } =
    generateValidTrack(segmentCount);
  console.log(`생성된 패턴: ${segmentPattern.length}개 세그먼트`);
  console.log(`패턴: ${segmentPattern.join(" -> ")}`);
  console.log(
    `코너 각도들: ${cornerAngles
      .map((a) => ((a * 180) / Math.PI).toFixed(1) + "°")
      .join(", ")}`
  );
  const lineCount = segmentPattern.filter((s) => s === "line").length;
  const cornerCount = segmentPattern.filter((s) => s === "corner").length;
  if (lineCount === 0 || cornerCount === 0) {
    throw new Error("직선과 곡선이 모두 있어야 합니다.");
  }
  const straightLength = (totalLength * 0.6) / lineCount;
  const arcLength = (totalLength * 0.4) / cornerCount;
  const segments: RaceSegment[] = [];
  let currentSegment: RaceSegment | null = null;
  let cornerIndex = 0;
  for (let i = 0; i < segmentPattern.length; i++) {
    const segmentType = segmentPattern[i];
    if (segmentType === "line") {
      if (i === 0) {
        currentSegment = createHorizontalLine(straightLength);
      } else {
        currentSegment = createLineFromSegment(currentSegment!, straightLength);
      }
      segments.push(currentSegment);
    } else if (segmentType === "corner") {
      const angle = cornerAngles[cornerIndex];
      currentSegment = createCornerFromSegment(
        currentSegment!,
        arcLength,
        angle
      );
      segments.push(currentSegment);
      cornerIndex++;
    }
  }
  const totalAngle = cornerAngles.reduce((sum, angle) => sum + angle, 0);
  console.log(`총 곡선 각도: ${((totalAngle * 180) / Math.PI).toFixed(2)}도`);
  if (segments.length > 0) {
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const firstPoints = firstSegment.getPoints(2);
    const lastPoints = lastSegment.getPoints(2);
    const distance = Math.sqrt(
      Math.pow(lastPoints[lastPoints.length - 1].x - firstPoints[0].x, 2) +
        Math.pow(lastPoints[lastPoints.length - 1].y - firstPoints[0].y, 2)
    );
    console.log(`트랙 닫힘 검증: 시작점-끝점 거리 = ${distance.toFixed(6)}`);
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
