import { Vector2D } from "./raceMath";

export type SegmentType = "line" | "corner";

export type BoundingBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export abstract class RaceSegment {
  start: Vector2D;
  end: Vector2D;
  length: number;
  type: SegmentType;

  constructor(start: Vector2D, end: Vector2D, type: SegmentType) {
    this.start = start;
    this.end = end;
    this.type = type;
    this.length = 0;
  }

  protected abstract calculateLength(): number;

  abstract getBounds(): BoundingBox;
  abstract getTangentDirectionAt(x: number, y: number): number;
  abstract getEndTangentDirection(): number;
  abstract isInner(x: number, y: number): boolean;
  abstract isEndAt(x: number, y: number): boolean;
  abstract orthoVectorAt(x: number, y: number): Vector2D;
  abstract raycastBoundary(
    rayPoint: Vector2D,
    rayDir: Vector2D,
    trackWidth: number
  ): Vector2D | null;
  abstract courseEffect(x: number, y: number, speed: number): Vector2D;
}
