import { RaceCorner } from "./raceCorner";
import { EPSILON, Vector2D } from "./raceMath";
import { BoundingBox, RaceSegment } from "./raceSegment";

export class RaceLine extends RaceSegment {
  constructor(start: Vector2D, end: Vector2D) {
    super(start, end, "line");
    this.length = this.calculateLength();
  }

  calculateLength(): number {
    return Math.hypot(this.end.x - this.start.x, this.end.y - this.start.y);
  }

  getBounds(): BoundingBox {
    return {
      minX: Math.min(this.start.x, this.end.x),
      maxX: Math.max(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxY: Math.max(this.start.y, this.end.y),
    };
  }

  getTangentDirectionAt(x: number, y: number): number {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  getEndTangentDirection(): number {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  isInner(x: number, y: number): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t = ((x - this.start.x) * dx + (y - this.start.y) * dy) / len2;
    const tClamped = Math.max(0, Math.min(1, t));
    const projX = this.start.x + dx * tClamped;
    const projY = this.start.y + dy * tClamped;
    const ortho = this.orthoVectorAt(x, y);
    const rel = (x - projX) * ortho.x + (y - projY) * ortho.y;
    return rel > 0;
  }

  isEndAt(x: number, y: number): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t = ((x - this.start.x) * dx + (y - this.start.y) * dy) / len2;
    return t >= 1;
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
    const x1 = this.start.x;
    const y1 = this.start.y;
    const x2 = this.end.x;
    const y2 = this.end.y;
    let offsetX = 0;
    let offsetY = 0;
    if (0 < trackWidth) {
      // segment의 법선 방향으로 offset 적용
      const segAngle = Math.atan2(y2 - y1, x2 - x1);
      const ortho = {
        x: Math.cos(segAngle - Math.PI / 2),
        y: Math.sin(segAngle - Math.PI / 2),
      };
      offsetX = ortho.x * trackWidth;
      offsetY = ortho.y * trackWidth;
    }
    const x1b = x1 + offsetX;
    const y1b = y1 + offsetY;
    const x2b = x2 + offsetX;
    const y2b = y2 + offsetY;
    const dx = x2b - x1b;
    const dy = y2b - y1b;
    const det = rayDir.x * dy - rayDir.y * dx;
    if (Math.abs(det) < EPSILON) {
      return null; // 평행 또는 겹침
    }
    const t = ((x1b - rayPoint.x) * dy - (y1b - rayPoint.y) * dx) / det;
    const s =
      ((x1b - rayPoint.x) * rayDir.y - (y1b - rayPoint.y) * rayDir.x) / det;
    if (t < -EPSILON || s < -EPSILON || s > 1 + EPSILON) {
      return null;
    }
    const ix = rayPoint.x + rayDir.x * t;
    const iy = rayPoint.y + rayDir.y * t;
    return { x: ix, y: iy };
  }

  courseEffect(x: number, y: number, speed: number): Vector2D {
    return { x: 0, y: 0 };
  }
}

export function createHorizontalLine(length: number): RaceLine {
  const start: Vector2D = { x: -length / 2, y: 0 };
  const end: Vector2D = { x: length / 2, y: 0 };
  return new RaceLine(start, end);
}

export function createLineFromCorner(
  corner: RaceCorner,
  length: number
): RaceLine {
  const dir = corner.getEndTangentDirection();
  const endX = corner.end.x + length * Math.cos(dir);
  const endY = corner.end.y + length * Math.sin(dir);
  const end: Vector2D = { x: endX, y: endY };
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
