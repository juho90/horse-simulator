import { convertAngleToDirection, DirectionType } from "./directionalDistance";

export type Vector2D = { x: number; y: number };

export const EPSILON = 1e-10;

export function Cost(from: Vector2D, to: Vector2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.hypot(dx, dy);
}

export function Distance(from: Vector2D, to: Vector2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function NormalizeAngle(a: number) {
  return (a + 2 * Math.PI) % (2 * Math.PI);
}

export function DiffAngle(from: number, to: number) {
  const diff = NormalizeAngle(from - to);
  if (diff > Math.PI) {
    return diff - 2 * Math.PI;
  }
  return diff;
}

export function NormalizeTheta(from: Vector2D, to: Vector2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return NormalizeAngle(Math.atan2(dy, dx));
}

export function Lerp(from: Vector2D, to: Vector2D, t: number): Vector2D {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export function LerpAngle(from: number, to: number, t: number): number {
  return from + DiffAngle(to, from) * t;
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
  if (end > start) {
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
  const angle = NormalizeAngle(NormalizeTheta(from, to) - heading);
  const direction = convertAngleToDirection(angle);
  return { direction, angle: angle };
}
