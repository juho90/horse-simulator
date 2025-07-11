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

  getBounds(): BoundingBox {
    return {
      minX: Math.min(this.start.x, this.end.x),
      maxX: Math.max(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxY: Math.max(this.start.y, this.end.y),
    };
  }

  getDirectionAt(x: number, y: number): number {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  getDirection(): number {
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

  isEndAt(x: number, y: number, tolerance: number): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t = ((x - this.start.x) * dx + (y - this.start.y) * dy) / len2;
    return t >= 1 - tolerance / Math.sqrt(len2);
  }

  orthoVectorAt(x: number, y: number): { x: number; y: number } {
    const dir = this.getDirectionAt(x, y);
    return {
      x: Math.cos(dir - Math.PI / 2),
      y: Math.sin(dir - Math.PI / 2),
    };
  }

  clampToTrackBoundary(x: number, y: number): { x: number; y: number } {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return { x: this.start.x, y: this.start.y };
    } else {
      const t = ((x - this.start.x) * dx + (y - this.start.y) * dy) / len2;
      const tClamped = Math.max(0, Math.min(1, t));
      const projX = this.start.x + dx * tClamped;
      const projY = this.start.y + dy * tClamped;
      const ortho = this.orthoVectorAt(x, y);
      return {
        x: projX + ortho.x * 0.5,
        y: projY + ortho.y * 0.5,
      };
    }
  }

  raycastBoundary(
    x0: number,
    y0: number,
    dirX: number,
    dirY: number,
    boundary: "inner" | "outer",
    trackWidth: number = 40
  ): Point | null {
    const x1 = this.start.x;
    const y1 = this.start.y;
    const x2 = this.end.x;
    const y2 = this.end.y;
    let offsetX = 0,
      offsetY = 0;
    if (boundary === "outer") {
      const dir = this.getDirectionAt(x0, y0);
      const ortho = {
        x: Math.cos(dir - Math.PI / 2),
        y: Math.sin(dir - Math.PI / 2),
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
    const det = dirX * dy - dirY * dx;
    if (Math.abs(det) < 1e-8) {
      return null;
    }
    const t = ((x1b - x0) * dy - (y1b - y0) * dx) / det;
    const s = ((x1b - x0) * dirY - (y1b - y0) * dirX) / det;
    if (t < 0 || s < 0 || s > 1) {
      return null;
    }
    const ix = x0 + dirX * t;
    const iy = y0 + dirY * t;
    return { x: ix, y: iy };
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
