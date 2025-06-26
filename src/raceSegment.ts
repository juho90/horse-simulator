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

  abstract getPoints(resolution?: number): Point[];
  abstract getBounds(): BoundingBox;
}
