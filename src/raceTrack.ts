import { RaceCorner } from "./raceCorner";
import { RaceLine } from "./raceLine";
import { Point, RaceSegment } from "./raceSegment";

export class RaceTrack {
  segments: RaceSegment[];
  totalLength: number;

  constructor(segments: RaceSegment[]) {
    this.segments = segments;
    this.totalLength = this.segments.reduce((sum, seg) => sum + seg.length, 0);
    if (!this.isClosed()) {
      throw new Error(
        "트랙이 닫혀있지 않습니다. 마지막 세그먼트의 end와 첫 세그먼트의 start가 일치해야 합니다."
      );
    }
  }

  isClosed(): boolean {
    if (this.segments.length < 2) return false;
    const first = this.segments[0].start;
    const last = this.segments[this.segments.length - 1].end;
    return (
      Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6
    );
  }

  getTrackPoints(resolution: number = 2000): Point[] {
    if (this.segments.length === 0 || this.totalLength === 0) return [];
    const points: Point[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const segRes = Math.max(
        2,
        Math.round(resolution * (seg.length / this.totalLength))
      );
      const segPoints = seg.getPoints(segRes);
      if (i === 0) points.push(...segPoints);
      else points.push(...segPoints.slice(1));
    }
    const first = points[0],
      last = points[points.length - 1];
    if (
      Math.abs(first.x - last.x) > 1e-6 ||
      Math.abs(first.y - last.y) > 1e-6
    ) {
      points.push({ ...first });
    }
    return points;
  }
}

export function createTrack(
  width: number,
  height: number,
  segmentCount: number
): RaceTrack {
  const cx = width / 2;
  const cy = height / 2;
  const a = (width / 2) * 0.85;
  const b = (height / 2) * 0.85;
  const radius = Math.min(a, b) * 0.4;

  const angleStep = (2 * Math.PI) / segmentCount;
  const points: Point[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const theta = i * angleStep;
    points.push({
      x: cx + a * Math.cos(theta),
      y: cy + b * Math.sin(theta),
    });
  }

  const segments: RaceSegment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const p0 = i === 0 ? points[segmentCount - 1] : points[i - 1];
    const p1 = points[i];

    if (i % 2 === 0) {
      segments.push(new RaceLine(p0, p1));
    } else {
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const vecX = midX - cx;
      const vecY = midY - cy;
      const vecLen = Math.sqrt(vecX * vecX + vecY * vecY);
      const normX = vecX / vecLen;
      const normY = vecY / vecLen;
      const center: Point = {
        x: midX + normX * radius,
        y: midY + normY * radius,
      };

      const corner = RaceCorner.fromStartEndCenter(p0, p1, center);
      segments.push(corner);
    }
  }

  return new RaceTrack(segments);
}
