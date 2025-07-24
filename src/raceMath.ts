import { DirectionType } from "./directionalDistance";

export type Vector2D = { x: number; y: number };

export const EPSILON = 1e-10;

export function Distance(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function NormalVector(a: Vector2D, b: Vector2D): Vector2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return { x: dy / len, y: -dx / len };
}

export function NormalizeAngle(a: number) {
  return (a + 2 * Math.PI) % (2 * Math.PI);
}

export function NormalizeTheta(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return NormalizeAngle(Math.atan2(dy, dx));
}

export function Lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function LerpAngle(a: number, b: number, t: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
}

export function ProjectOnSegment(
  x: number,
  y: number,
  a: Vector2D,
  b: Vector2D
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return 0;
  }
  let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

export function OuterGuardrail(
  innerPoints: Vector2D[],
  offset: number
): Vector2D[] {
  return innerPoints.map((pt: Vector2D, i: number) => {
    const prev = innerPoints[i === 0 ? innerPoints.length - 1 : i - 1];
    const next = innerPoints[(i + 1) % innerPoints.length];
    const n = NormalVector(prev, next);
    return { x: pt.x + n.x * offset, y: pt.y + n.y * offset };
  });
}

export function IntersectCircleLineNear(
  center: Vector2D,
  radius: number,
  rayPoint: Vector2D,
  rayDir: Vector2D,
  startAngle: number,
  endAngle: number
): Vector2D | null {
  const dx = rayPoint.x - center.x;
  const dy = rayPoint.y - center.y;
  const a = rayDir.x * rayDir.x + rayDir.y * rayDir.y;
  const b = 2 * (dx * rayDir.x + dy * rayDir.y);
  const c = dx * dx + dy * dy - radius * radius;
  const d = b * b - 4 * a * c;
  if (d < 0) {
    return null;
  }
  const sqrtD = Math.sqrt(d);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  if (Math.abs(t1) < Math.abs(t2)) {
    const point = {
      x: rayPoint.x + rayDir.x * t1,
      y: rayPoint.y + rayDir.y * t1,
    };
    if (IsAngleBetween(point, center, startAngle, endAngle)) {
      return point;
    }
  }
  const point = {
    x: rayPoint.x + rayDir.x * t2,
    y: rayPoint.y + rayDir.y * t2,
  };
  if (IsAngleBetween(point, center, startAngle, endAngle)) {
    return point;
  }
  return null;
}

export function IsAngleBetween(
  point: Vector2D,
  center: Vector2D,
  startAngle: number,
  endAngle: number
): boolean {
  const theta = NormalizeTheta(center, point);
  const start = NormalizeAngle(startAngle);
  const end = NormalizeAngle(endAngle);
  if (start <= end) {
    return start <= theta && theta <= end;
  } else {
    return start <= theta || theta <= end;
  }
}

export function CalculateDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  heading: number
): { direction: DirectionType | null; angle: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const relativeAngle = NormalizeAngle(angle - heading);
  if (relativeAngle >= (7 * Math.PI) / 4 || relativeAngle < Math.PI / 4) {
    return { direction: DirectionType.FRONT, angle: relativeAngle };
  }
  if (relativeAngle < (3 * Math.PI) / 4) {
    return { direction: DirectionType.FRONT_LEFT, angle: relativeAngle };
  }
  if (relativeAngle < (5 * Math.PI) / 4) {
    return { direction: DirectionType.LEFT, angle: relativeAngle };
  }
  if (relativeAngle < (7 * Math.PI) / 4) {
    return { direction: DirectionType.FRONT_RIGHT, angle: relativeAngle };
  }
  if (relativeAngle < 2 * Math.PI) {
    return { direction: DirectionType.RIGHT, angle: relativeAngle };
  }
  return { direction: null, angle: relativeAngle };
}
