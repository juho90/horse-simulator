import { RaceLine } from "./raceLine";
import { BoundingBox, Point, RaceSegment } from "./raceSegment";

export class RaceCorner extends RaceSegment {
  center: Point;
  radius: number;
  angle: number;
  startAngle: number;
  endAngle: number;

  constructor(start: Point, center: Point, angle: number) {
    const radius = Math.hypot(start.x - center.x, start.y - center.y);
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = startAngle + angle;
    const end: Point = {
      x: center.x + radius * Math.cos(endAngle),
      y: center.y + radius * Math.sin(endAngle),
    };
    super(start, end, "corner");
    this.center = center;
    this.radius = radius;
    this.angle = angle;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.length = this.calculateLength();
  }

  calculateLength(): number {
    return Math.abs(this.radius * this.angle);
  }

  getPoints(resolution: number = 100): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= resolution; i++) {
      const theta = this.startAngle + (this.angle * i) / resolution;
      points.push({
        x: this.center.x + this.radius * Math.cos(theta),
        y: this.center.y + this.radius * Math.sin(theta),
      });
    }
    return points;
  }

  getBounds(): BoundingBox {
    return {
      minX: this.center.x - this.radius,
      maxX: this.center.x + this.radius,
      minY: this.center.y - this.radius,
      maxY: this.center.y + this.radius,
    };
  }
}

export function createHorizontalCorner(
  arcLength: number,
  angle: number
): RaceCorner {
  const radius = arcLength / Math.abs(angle);
  const start: Point = { x: 0, y: 0 };
  const center: Point = { x: 0, y: radius };
  return new RaceCorner(start, center, angle);
}

export function createCornerFromLine(
  line: RaceLine,
  arcLength: number,
  angle: number
): RaceCorner {
  const lineAngle = Math.atan2(
    line.end.y - line.start.y,
    line.end.x - line.start.x
  );
  const radius = arcLength / Math.abs(angle);
  const centerAngle = lineAngle + Math.PI / 2;
  const centerX = line.end.x + radius * Math.cos(centerAngle);
  const centerY = line.end.y + radius * Math.sin(centerAngle);
  const center: Point = { x: centerX, y: centerY };
  return new RaceCorner(line.end, center, angle);
}

export function createCornerFromCorner(
  corner: RaceCorner,
  arcLength: number,
  angle: number
): RaceCorner {
  const tangentAngle = corner.endAngle + Math.PI / 2;
  const radius = arcLength / Math.abs(angle);
  const centerAngle = tangentAngle + Math.PI / 2;
  const centerX = corner.end.x + radius * Math.cos(centerAngle);
  const centerY = corner.end.y + radius * Math.sin(centerAngle);
  const center: Point = { x: centerX, y: centerY };
  return new RaceCorner(corner.end, center, angle);
}

export function createCornerFromSegment(
  segment: RaceSegment,
  arcLength: number,
  angle: number
): RaceCorner {
  if (segment.type === "line") {
    return createCornerFromLine(segment as RaceLine, arcLength, angle);
  } else if (segment.type === "corner") {
    return createCornerFromCorner(segment as RaceCorner, arcLength, angle);
  } else {
    throw new Error("지원되지 않는 세그먼트 타입입니다.");
  }
}
