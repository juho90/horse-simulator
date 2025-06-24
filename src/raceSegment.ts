export type Point = { x: number; y: number };

export type SegmentType = "line" | "corner";

export abstract class RaceSegment {
  start: Point;
  end: Point;
  length: number;
  type: SegmentType;

  constructor(start: Point, end: Point, type: SegmentType) {
    this.start = start;
    this.end = end;
    this.type = type;
    this.length = this.calculateLength();
  }

  abstract calculateLength(): number;

  abstract getPoints(resolution?: number): Point[];
}
