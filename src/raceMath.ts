export type Vector2D = { x: number; y: number };

export function getOuterGuardrail(
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

export function NormalVector(a: Vector2D, b: Vector2D): Vector2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return { x: dy / len, y: -dx / len };
}

export function Lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
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
