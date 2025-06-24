import { CornerDirection, RaceCorner } from "./raceCorner";
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
    if (this.segments.length < 2) {
      return false;
    }
    const first = this.segments[0].start;
    const last = this.segments[this.segments.length - 1].end;
    return (
      Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6
    );
  }

  getTrackPoints(resolution: number = 2000): Point[] {
    const totalLength = this.totalLength;
    if (this.segments.length === 0 || totalLength === 0) return [];
    const points: Point[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const segRes = Math.max(
        2,
        Math.round(resolution * (seg.length / totalLength))
      );
      const segPoints = seg.getPoints(segRes);
      if (i === 0) {
        points.push(...segPoints);
      } else {
        points.push(...segPoints.slice(1));
      }
    }
    if (points.length > 1) {
      const first = points[0],
        last = points[points.length - 1];
      if (
        Math.abs(first.x - last.x) > 1e-6 ||
        Math.abs(first.y - last.y) > 1e-6
      ) {
        points.push({ ...first });
      }
    }
    return points;
  }
}

export function createTrack(trackLength: number): RaceTrack {
  // 타원형 기반 트랙 생성
  const minLen = 1200,
    maxLen = 3600;
  const len = Math.max(
    minLen,
    Math.min(maxLen, Math.round(trackLength / 100) * 100)
  );
  // 타원의 장축(a), 단축(b) 계산 (a > b)
  const a = len / (2 * Math.PI); // 대략적인 장축
  const b = a * 0.6; // 단축은 장축의 60% 정도
  const center: Point = { x: 0, y: 0 };
  const segments: RaceSegment[] = [];
  const N = 8; // 직선-곡선 4쌍(8세그먼트)
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * 2 * Math.PI;
    const t1 = ((i + 1) / N) * 2 * Math.PI;
    const p0 = {
      x: center.x + a * Math.cos(t0),
      y: center.y + b * Math.sin(t0),
    };
    const p1 = {
      x: center.x + a * Math.cos(t1),
      y: center.y + b * Math.sin(t1),
    };
    if (i % 2 === 0) {
      // 직선: 타원 위 두 점을 직선으로 연결
      segments.push(new RaceLine(p0, p1));
    } else {
      // 곡선: 타원 호를 근사하는 원호
      const midT = (t0 + t1) / 2;
      const mid = {
        x: center.x + a * Math.cos(midT),
        y: center.y + b * Math.sin(midT),
      };
      // 반지름: p0~mid 거리
      const radius = Math.hypot(mid.x - p0.x, mid.y - p0.y);
      // 방향: left/right 번갈이
      const direction: CornerDirection = i % 4 === 1 ? "left" : "right";
      // 중심: p0에서 mid로 radius만큼 이동
      const angle = Math.atan2(mid.y - p0.y, mid.x - p0.x);
      const cx = p0.x + radius * Math.cos(angle);
      const cy = p0.y + radius * Math.sin(angle);
      segments.push(
        new RaceCorner(p0, radius, Math.PI / 2, direction, { x: cx, y: cy })
      );
    }
  }
  // 마지막 세그먼트가 첫 점과 정확히 닫히도록 보정
  if (
    Math.abs(segments[0].start.x - segments[N - 1].end.x) > 1e-6 ||
    Math.abs(segments[0].start.y - segments[N - 1].end.y) > 1e-6
  ) {
    segments.push(new RaceLine(segments[N - 1].end, segments[0].start));
  }
  return new RaceTrack(segments);
}
