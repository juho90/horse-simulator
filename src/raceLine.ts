import { RaceCorner } from "./raceCorner";
import {
  AddDirectionToAngle,
  DirectionType,
  Distance,
  NormalizeTheta,
  Vector2D,
} from "./raceMath";
import {
  BoundingBox,
  RaceSegment,
  RaceSegmentNode,
  SegmentType,
} from "./raceSegment";

export class RaceLine extends RaceSegment {
  constructor(segmentIndex: number, start: Vector2D, end: Vector2D) {
    super(segmentIndex, start, end, SegmentType.LINE);
    this.length = this.calculateLength();
  }

  calculateLength(): number {
    return Distance(this.end, this.start);
  }

  getBounds(): BoundingBox {
    return {
      minX: Math.min(this.start.x, this.end.x),
      maxX: Math.max(this.start.x, this.end.x),
      minY: Math.min(this.start.y, this.end.y),
      maxY: Math.max(this.start.y, this.end.y),
    };
  }

  getTangentDirectionAt(pos: Vector2D): number {
    return NormalizeTheta(this.start, this.end);
  }

  getEndTangentDirection(): number {
    return NormalizeTheta(this.start, this.end);
  }

  getOrthoVectorAt(pos: Vector2D): Vector2D {
    const dir = this.getTangentDirectionAt(pos);
    const angle = AddDirectionToAngle(dir, DirectionType.LEFT);
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  }

  getSampleNodes(
    trackWidth: number,
    resolution: number,
    padding: number
  ): RaceSegmentNode[][] {
    const nodes: RaceSegmentNode[][] = [];
    let laIndex = 0;
    for (let lane = padding; lane <= trackWidth - padding; lane += resolution) {
      const count = Math.ceil(this.length / resolution);
      const laneNodes: RaceSegmentNode[] = [];
      for (let prIndex = 0; prIndex <= count; prIndex++) {
        const progress = prIndex / count;
        const x = this.start.x + (this.end.x - this.start.x) * progress;
        const y = this.start.y + (this.end.y - this.start.y) * progress;
        const ortho = this.getOrthoVectorAt({ x, y });
        const nodeX = x + ortho.x * lane;
        const nodeY = y + ortho.y * lane;
        laneNodes.push({
          x: nodeX,
          y: nodeY,
          segmentIndex: this.segmentIndex,
          progress: progress,
          lane: laIndex,
        });
      }
      nodes.push(laneNodes);
      laIndex++;
    }
    return nodes;
  }
}

export function createHorizontalLine(length: number): RaceLine {
  const start: Vector2D = { x: -length / 2, y: 0 };
  const end: Vector2D = { x: length / 2, y: 0 };
  return new RaceLine(0, start, end);
}

export function createLineFromCorner(
  corner: RaceCorner,
  length: number
): RaceLine {
  const dir = corner.getEndTangentDirection();
  const endX = corner.end.x + length * Math.cos(dir);
  const endY = corner.end.y + length * Math.sin(dir);
  const end: Vector2D = { x: endX, y: endY };
  return new RaceLine(corner.segmentIndex + 1, corner.end, end);
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
