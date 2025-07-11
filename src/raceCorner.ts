import { RaceLine } from "./raceLine";
import { BoundingBox, Point, RaceSegment } from "./raceSegment";

export class RaceCorner extends RaceSegment {
  center: Point;
  radius: number;
  angle: number;
  startAngle: number;
  endAngle: number;

  constructor(start: Point, center: Point, radius: number, angle: number) {
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

  getBounds(): BoundingBox {
    return {
      minX: this.center.x - this.radius,
      maxX: this.center.x + this.radius,
      minY: this.center.y - this.radius,
      maxY: this.center.y + this.radius,
    };
  }

  getDirectionAt(x: number, y: number): number {
    const angle = Math.atan2(y - this.center.y, x - this.center.x);
    return angle + Math.PI / 2;
  }

  getDirection(): number {
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
    const start = RaceCorner.normalize(this.startAngle);
    const end = RaceCorner.normalize(this.endAngle);
    let theta = RaceCorner.normalize(angle);
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

  orthoVectorAt(x: number, y: number): { x: number; y: number } {
    const dir = this.getDirectionAt(x, y);
    return {
      x: Math.cos(dir - Math.PI / 2),
      y: Math.sin(dir - Math.PI / 2),
    };
  }

  clampToTrackBoundary(x: number, y: number): { x: number; y: number } {
    const ortho = this.orthoVectorAt(x, y);
    return {
      x: this.center.x + (this.radius + 0.5) * ortho.x,
      y: this.center.y + (this.radius + 0.5) * ortho.y,
    };
  }

  raycastBoundary(
    x0: number,
    y0: number,
    dirX: number,
    dirY: number,
    boundary: "inner" | "outer",
    trackWidth: number = 40
  ): Point | null {
    const radius =
      boundary === "outer" ? this.radius + trackWidth : this.radius;
    const dx = x0 - this.center.x;
    const dy = y0 - this.center.y;
    const a = dirX * dirX + dirY * dirY;
    const b = 2 * (dx * dirX + dy * dirY);
    const c = dx * dx + dy * dy - radius * radius;
    const D = b * b - 4 * a * c;
    if (D < 0) {
      return null;
    }
    const sqrtD = Math.sqrt(D);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);
    const t = t1 >= 0 ? t1 : t2 >= 0 ? t2 : null;
    if (t === null) {
      return null;
    }
    const ix = x0 + dirX * t;
    const iy = y0 + dirY * t;
    const angle = Math.atan2(iy - this.center.y, ix - this.center.x);
    const start = RaceCorner.normalize(this.startAngle);
    const end = RaceCorner.normalize(this.endAngle);
    const theta = RaceCorner.normalize(angle);
    let inArc = false;
    if (start < end) {
      inArc = theta >= start && theta <= end;
    } else {
      inArc = theta >= start || theta <= end;
    }
    return inArc ? { x: ix, y: iy } : null;
  }

  static normalize(a: number) {
    return (a + 2 * Math.PI) % (2 * Math.PI);
  }
}

export function createHorizontalCorner(
  radius: number,
  angle: number
): RaceCorner {
  const start: Point = { x: 0, y: 0 };
  const center: Point = { x: 0, y: radius };
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
  const center: Point = { x: centerX, y: centerY };
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
  const center: Point = { x: centerX, y: centerY };
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
