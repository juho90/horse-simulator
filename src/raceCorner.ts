import { addDirectionToAngle, DirectionType } from "./directionalDistance";
import { RaceLine } from "./raceLine";
import {
  DiffAngle,
  IntersectCircleLineNear,
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

  getProgress(x: number, y: number): number {
    const currentAngle = Math.atan2(y - this.center.y, x - this.center.x);
    let angleDifference = currentAngle - this.startAngle;
    angleDifference =
      ((angleDifference % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const totalAngle = Math.abs(this.angle);
    angleDifference = Math.min(angleDifference, totalAngle);
    const progressDistance = this.radius * angleDifference;
    return Math.max(0, Math.min(1, progressDistance / this.length));
  }

  getProgressAt(x: number, y: number): Vector2D {
    const progress = this.getProgress(x, y);
    const angle = LerpAngle(this.startAngle, this.endAngle, progress);
    return {
      x: this.center.x + this.radius * Math.cos(angle),
      y: this.center.y + this.radius * Math.sin(angle),
    };
  }

  getTangentDirectionAt(x: number, y: number): number {
    const angle = Math.atan2(y - this.center.y, x - this.center.x);
    return addDirectionToAngle(angle, DirectionType.RIGHT);
  }

  getEndTangentDirection(): number {
    return addDirectionToAngle(this.endAngle, DirectionType.RIGHT);
  }

  getOrthoVectorAt(x: number, y: number): Vector2D {
    const dir = this.getTangentDirectionAt(x, y);
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
  ): RaceSegmentNode[] {
    const nodes: RaceSegmentNode[] = [];
    let laIndex = 0;
    for (let lane = padding; lane <= trackWidth - padding; lane += resolution) {
      const radius = this.radius + lane;
      const diffAngle = DiffAngle(this.endAngle, this.startAngle);
      const arcLength = diffAngle * radius;
      const count = Math.ceil(arcLength / resolution);
      for (let prIndex = 0; prIndex <= count; prIndex++) {
        const progress = prIndex / count;
        const angle = LerpAngle(this.startAngle, this.endAngle, progress);
        const nodeX = this.center.x + radius * Math.cos(angle);
        const nodeY = this.center.y + radius * Math.sin(angle);
        nodes.push({
          x: nodeX,
          y: nodeY,
          segmentIndex: this.segmentIndex,
          progress: progress,
          lane: laIndex,
        });
      }
    }
    return nodes;
  }

  isInside(x: number, y: number, tolerance: number): boolean {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dist - this.radius) > tolerance) {
      return false;
    }
    const start = NormalizeAngle(this.startAngle);
    const end = NormalizeAngle(this.endAngle);
    let theta = NormalizeAngle(Math.atan2(dy, dx));
    if (start < end) {
      if (theta < start || end < theta) {
        return false;
      }
    } else {
      if (theta < start && end < theta) {
        return false;
      }
    }
    return true;
  }

  isInner(x: number, y: number): boolean {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.hypot(dx, dy);
    return dist > this.radius;
  }

  isEndAt(x: number, y: number): boolean {
    const angle = Math.atan2(y - this.center.y, x - this.center.x);
    const norm = NormalizeAngle(angle - this.startAngle);
    const span = NormalizeAngle(this.endAngle - this.startAngle);
    return norm >= span - 0.05;
  }

  raycastBoundary(
    rayPoint: Vector2D,
    rayDir: Vector2D,
    trackWidth: number
  ): Vector2D | null {
    const radius = this.radius + trackWidth;
    return IntersectCircleLineNear(
      this.center,
      radius,
      rayPoint,
      rayDir,
      this.startAngle,
      this.endAngle
    );
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
  const centerAngle = addDirectionToAngle(lineAngle, DirectionType.RIGHT);
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
  const tangentAngle = addDirectionToAngle(
    corner.endAngle,
    DirectionType.RIGHT
  );
  const centerAngle = addDirectionToAngle(tangentAngle, DirectionType.RIGHT);
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
