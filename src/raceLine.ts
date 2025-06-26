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

  getPoints(resolution: number = 100): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      points.push({
        x: this.start.x + (this.end.x - this.start.x) * t,
        y: this.start.y + (this.end.y - this.start.y) * t,
      });
    }
    return points;
  }

  getBounds(): BoundingBox {
    return {
      minX: Math.min(this.start.x, this.end.x),
      maxX: Math.max(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxY: Math.max(this.start.y, this.end.y),
    };
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
  const tangentAngle = corner.endAngle + Math.PI / 2;
  const endX = corner.end.x + length * Math.cos(tangentAngle);
  const endY = corner.end.y + length * Math.sin(tangentAngle);
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
