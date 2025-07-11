export type Point = { x: number; y: number };

export type SegmentType = "line" | "corner";

export type BoundingBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export abstract class RaceSegment {
  start: Point;
  end: Point;
  length: number;
  type: SegmentType;

  constructor(start: Point, end: Point, type: SegmentType) {
    this.start = start;
    this.end = end;
    this.type = type;
    this.length = 0;
  }

  protected abstract calculateLength(): number;

  abstract getBounds(): BoundingBox;
  abstract getDirectionAt(x: number, y: number): number;
  abstract getDirection(): number;
  abstract isInner(x: number, y: number): boolean;
  abstract isEndAt(x: number, y: number, tolerance: number): boolean;
  abstract orthoVectorAt(x: number, y: number): { x: number; y: number };
  abstract clampToTrackBoundary(x: number, y: number): { x: number; y: number };
  abstract raycastBoundary(
    x0: number,
    y0: number,
    dirX: number,
    dirY: number,
    boundary: "inner" | "outer",
    trackWidth?: number
  ): Point | null;
}
