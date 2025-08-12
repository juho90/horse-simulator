import { RaceLine } from "./raceLine";
import {
  AddDirectionToAngle,
  DiffAngle,
  DirectionType,
  LerpAngle,
  NormalizeAngle,
  NormalizeTheta,
  Vector2D,
} from "./raceMath";
import {
  BoundingBox,
  RaceSegment,
  RaceSegmentNode,
  SegmentType,
} from "./raceSegment";

export class RaceCorner extends RaceSegment {
  center: Vector2D;
  radius: number;
  angle: number;
  startAngle: number;
  endAngle: number;

  constructor(
    segmentIndex: number,
    start: Vector2D,
    center: Vector2D,
    radius: number,
    angle: number
  ) {
    const startAngle = NormalizeTheta(center, start);
    const endAngle = NormalizeAngle(startAngle + angle);
    const end: Vector2D = {
      x: center.x + radius * Math.cos(endAngle),
      y: center.y + radius * Math.sin(endAngle),
    };
    super(segmentIndex, start, end, SegmentType.CORNER);
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

  getTangentDirectionAt(pos: Vector2D): number {
    const angle = Math.atan2(pos.y - this.center.y, pos.x - this.center.x);
    return AddDirectionToAngle(angle, DirectionType.RIGHT);
  }

  getEndTangentDirection(): number {
    return AddDirectionToAngle(this.endAngle, DirectionType.RIGHT);
  }

  getOrthoVectorAt(pos: Vector2D): Vector2D {
    const dir = this.getTangentDirectionAt(pos);
    const angle = AddDirectionToAngle(dir, DirectionType.LEFT);
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  }

  getNodes(
    trackWidth: number,
    resolution: number,
    padding: number
  ): RaceSegmentNode[][] {
    const nodes: RaceSegmentNode[][] = [];
    let laIndex = 0;
    for (let lane = padding; lane <= trackWidth - padding; lane += resolution) {
      const radius = this.radius + lane;
      const diffAngle = DiffAngle(this.startAngle, this.endAngle);
      const arcLength = diffAngle * radius;
      const count = Math.ceil(arcLength / resolution);
      const laneNodes: RaceSegmentNode[] = [];
      for (let prIndex = 0; prIndex <= count; prIndex++) {
        const progress = prIndex / count;
        const angle = LerpAngle(this.startAngle, this.endAngle, progress);
        const nodeX = this.center.x + radius * Math.cos(angle);
        const nodeY = this.center.y + radius * Math.sin(angle);
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

export function createHorizontalCorner(
  radius: number,
  angle: number
): RaceCorner {
  const start: Vector2D = { x: 0, y: 0 };
  const center: Vector2D = { x: 0, y: radius };
  return new RaceCorner(0, start, center, radius, angle);
}

export function createCornerFromLine(
  line: RaceLine,
  radius: number,
  angle: number
): RaceCorner {
  const lineAngle = NormalizeTheta(line.start, line.end);
  const centerAngle = AddDirectionToAngle(lineAngle, DirectionType.RIGHT);
  const centerX = line.end.x + radius * Math.cos(centerAngle);
  const centerY = line.end.y + radius * Math.sin(centerAngle);
  const center: Vector2D = { x: centerX, y: centerY };
  return new RaceCorner(line.segmentIndex + 1, line.end, center, radius, angle);
}

export function createCornerFromCorner(
  corner: RaceCorner,
  radius: number,
  angle: number
): RaceCorner {
  const tangentAngle = AddDirectionToAngle(
    corner.endAngle,
    DirectionType.RIGHT
  );
  const centerAngle = AddDirectionToAngle(tangentAngle, DirectionType.RIGHT);
  const centerX = corner.end.x + radius * Math.cos(centerAngle);
  const centerY = corner.end.y + radius * Math.sin(centerAngle);
  const center: Vector2D = { x: centerX, y: centerY };
  return new RaceCorner(
    corner.segmentIndex + 1,
    corner.end,
    center,
    radius,
    angle
  );
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
