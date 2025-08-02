import { addDirectionToAngle, DirectionType } from "./directionalDistance";
import { RaceCorner } from "./raceCorner";
import { Distance, EPSILON, NormalizeTheta, Vector2D } from "./raceMath";
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

  getProgress(pos: Vector2D): number {
    const directionX = this.end.x - this.start.x;
    const directionY = this.end.y - this.start.y;
    const len2 = directionX * directionX + directionY * directionY;
    if (len2 === 0) {
      return 0;
    }
    const positionX = pos.x - this.start.x;
    const positionY = pos.y - this.start.y;
    const t = (positionX * directionX + positionY * directionY) / len2;
    return Math.max(0, t);
  }

  getProgressAt(pos: Vector2D): Vector2D {
    const progress = this.getProgress(pos);
    return {
      x: this.start.x + (this.end.x - this.start.x) * progress,
      y: this.start.y + (this.end.y - this.start.y) * progress,
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
    const angle = addDirectionToAngle(dir, DirectionType.LEFT);
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

  isInner(pos: Vector2D): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t =
      ((pos.x - this.start.x) * dx + (pos.y - this.start.y) * dy) / len2;
    const tClamped = Math.max(0, Math.min(1, t));
    const projX = this.start.x + dx * tClamped;
    const projY = this.start.y + dy * tClamped;
    const ortho = this.getOrthoVectorAt(pos);
    const rel = (pos.x - projX) * ortho.x + (pos.y - projY) * ortho.y;
    return rel > 0;
  }

  isEndAt(pos: Vector2D): boolean {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return false;
    }
    const t =
      ((pos.x - this.start.x) * dx + (pos.y - this.start.y) * dy) / len2;
    return t >= 1;
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
      const ortho = this.getOrthoVectorAt({ x: x1, y: y1 });
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
      return null;
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

  courseEffect(pos: Vector2D, speed: number): Vector2D {
    return { x: 0, y: 0 };
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
