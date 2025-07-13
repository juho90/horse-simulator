import { RaceLine } from "./raceLine";
import {
  IntersectCircleLineNear,
  IsAngleBetween,
  NormalizeAngle,
  Vector2D,
} from "./raceMath";
import { BoundingBox, RaceSegment } from "./raceSegment";

export class RaceCorner extends RaceSegment {
  center: Vector2D;
  radius: number;
  angle: number;
  startAngle: number;
  endAngle: number;

  constructor(
    start: Vector2D,
    center: Vector2D,
    radius: number,
    angle: number
  ) {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = startAngle + angle;
    const end: Vector2D = {
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

  getBounds(): BoundingBox {
    return {
      minX: this.center.x - this.radius,
      maxX: this.center.x + this.radius,
      minY: this.center.y - this.radius,
      maxY: this.center.y + this.radius,
    };
  }

  getTangentDirectionAt(x: number, y: number): number {
    const angle = Math.atan2(y - this.center.y, x - this.center.x);
    return angle + Math.PI / 2;
  }

  getEndTangentDirection(): number {
    return this.endAngle + Math.PI / 2;
  }

  isInside(x: number, y: number, tolerance: number): boolean {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dist - this.radius) > tolerance) {
      return false;
    }
    const angle = Math.atan2(dy, dx);
    const start = NormalizeAngle(this.startAngle);
    const end = NormalizeAngle(this.endAngle);
    let theta = NormalizeAngle(angle);
    if (start < end) {
      if (theta < start || end < theta) {
        return false;
      }
    } else {
      if (theta < start && end < theta) {
        return false;
      }
    }
    return true;
  }

  isInner(x: number, y: number): boolean {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.hypot(dx, dy);
    return dist > this.radius;
  }

  isEndAt(x: number, y: number, tolerance: number): boolean {
    const angle = Math.atan2(y - this.center.y, x - this.center.x);
    const norm = (angle - this.startAngle + 2 * Math.PI) % (2 * Math.PI);
    const span =
      (this.endAngle - this.startAngle + 2 * Math.PI) % (2 * Math.PI);
    return norm >= span - 0.05;
  }

  orthoVectorAt(x: number, y: number): Vector2D {
    const dir = this.getTangentDirectionAt(x, y);
    return {
      x: Math.cos(dir - Math.PI / 2),
      y: Math.sin(dir - Math.PI / 2),
    };
  }

  raycastBoundary(
    rayPoint: Vector2D,
    rayDir: Vector2D,
    trackWidth: number
  ): Vector2D | null {
    const radius = this.radius + trackWidth;
    const point = IntersectCircleLineNear(
      this.center,
      radius,
      rayPoint,
      rayDir
    );
    if (point) {
      if (!IsAngleBetween(point, this.center, this.startAngle, this.endAngle)) {
        return null;
      }
      return point;
    }
    return null;
  }

  courseEffect(x: number, y: number, speed: number): Vector2D {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      const centrifugalCoeff = 0.18;
      const force = (centrifugalCoeff * (speed * speed)) / this.radius;
      return {
        x: (dx / dist) * force,
        y: (dy / dist) * force,
      };
    }
    return { x: 0, y: 0 };
  }
}

export function createHorizontalCorner(
  radius: number,
  angle: number
): RaceCorner {
  const start: Vector2D = { x: 0, y: 0 };
  const center: Vector2D = { x: 0, y: radius };
  return new RaceCorner(start, center, radius, angle);
}

export function createCornerFromLine(
  line: RaceLine,
  radius: number,
  angle: number
): RaceCorner {
  const lineAngle = Math.atan2(
    line.end.y - line.start.y,
    line.end.x - line.start.x
  );
  const centerAngle = lineAngle + Math.PI / 2;
  const centerX = line.end.x + radius * Math.cos(centerAngle);
  const centerY = line.end.y + radius * Math.sin(centerAngle);
  const center: Vector2D = { x: centerX, y: centerY };
  return new RaceCorner(line.end, center, radius, angle);
}

export function createCornerFromCorner(
  corner: RaceCorner,
  radius: number,
  angle: number
): RaceCorner {
  const tangentAngle = corner.endAngle + Math.PI / 2;
  const centerAngle = tangentAngle + Math.PI / 2;
  const centerX = corner.end.x + radius * Math.cos(centerAngle);
  const centerY = corner.end.y + radius * Math.sin(centerAngle);
  const center: Vector2D = { x: centerX, y: centerY };
  return new RaceCorner(corner.end, center, radius, angle);
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
