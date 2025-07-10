import { RaceCorner } from "./raceCorner";
import { BoundingBox, Point, RaceSegment } from "./raceSegment";

export class RaceLine extends RaceSegment {
  constructor(start: Point, end: Point) {
    super(start, end, "line");
    this.length = this.calculateLength();
  }

  calculateLength(): number {
    return Math.hypot(this.end.x - this.start.x, this.end.y - this.start.y);
  }

  getDirectionAt(x: number, y: number): number {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  getDirection(): number {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  getBounds(): BoundingBox {
    return {
      minX: Math.min(this.start.x, this.end.x),
      maxX: Math.max(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxY: Math.max(this.start.y, this.end.y),
    };
  }

  isInside(x: number, y: number, tolerance: number): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t = ((x - this.start.x) * dx + (y - this.start.y) * dy) / len2;
    if (t < 0 || 1 < t) {
      return false;
    }
    const projX = this.start.x + dx * t;
    const projY = this.start.y + dy * t;
    const dist = Math.hypot(x - projX, y - projY);
    return dist < tolerance;
  }
}

export function createHorizontalLine(length: number): RaceLine {
  const start: Point = { x: -length / 2, y: 0 };
  const end: Point = { x: length / 2, y: 0 };
  return new RaceLine(start, end);
}

export function createLineFromCorner(
  corner: RaceCorner,
  length: number
): RaceLine {
  const dir = corner.getDirection();
  const endX = corner.end.x + length * Math.cos(dir);
  const endY = corner.end.y + length * Math.sin(dir);
  const end: Point = { x: endX, y: endY };
  return new RaceLine(corner.end, end);
}

export function createLineFromSegment(
  segment: RaceSegment,
  length: number
): RaceLine {
  if (segment.type === "corner") {
    return createLineFromCorner(segment as RaceCorner, length);
  } else {
    throw new Error("직선에서 직선으로의 연결은 지원되지 않습니다.");
  }
}
