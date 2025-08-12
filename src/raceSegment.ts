import { Vector2D } from "./raceMath";

export type BoundingBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export enum SegmentType {
  LINE = "line",
  CORNER = "corner",
}

export interface RaceSegmentNode {
  x: number;
  y: number;
  segmentIndex: number;
  progress: number;
  lane: number;
}

export abstract class RaceSegment {
  segmentIndex: number;
  start: Vector2D;
  end: Vector2D;
  length: number;
  type: SegmentType;

  constructor(
    segmentIndex: number,
    start: Vector2D,
    end: Vector2D,
    type: SegmentType
  ) {
    this.segmentIndex = segmentIndex;
    this.start = start;
    this.end = end;
    this.type = type;
    this.length = 0;
  }

  private cumulativeProgress: number = 0;

  getCumulativeProgress(): number {
    return this.cumulativeProgress;
  }

  setCumulativeProgress(progress: number): void {
    this.cumulativeProgress = progress;
  }

  protected abstract calculateLength(): number;

  abstract getBounds(): BoundingBox;
  abstract getTangentDirectionAt(pos: Vector2D): number;
  abstract getEndTangentDirection(): number;
  abstract getOrthoVectorAt(pos: Vector2D): Vector2D;
  abstract getNodes(
    trackWidth: number,
    resolution: number,
    padding: number
  ): RaceSegmentNode[][];
}

export const TRACK_WIDTH = 200;
