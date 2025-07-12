import { Vector2D } from "./raceMath";
import { RaceSegment } from "./raceSegment";

export interface RaycastResult {
  segment: RaceSegment;
  hitPoint: Vector2D;
  hitDistance: number;
  rayDir: Vector2D;
  rayAngle: number;
}

export function raycastBoundary(
  x: number,
  y: number,
  heading: number,
  segments: RaceSegment[],
  trackWidth: number,
  directions: number[] = [
    0,
    Math.PI / 4,
    -Math.PI / 4,
    Math.PI / 2,
    -Math.PI / 2,
  ]
): {
  closestRaycast: RaycastResult | null;
  farthestRaycast: RaycastResult | null;
} {
  let closestRaycast: RaycastResult | null = null;
  let farthestRaycast: RaycastResult | null = null;
  for (const segment of segments) {
    for (const offset of directions) {
      const angle = heading + offset;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const innerPoint = segment.raycastBoundary(x, y, dirX, dirY, 0);
      if (innerPoint) {
        const dist = Math.hypot(innerPoint.x - x, innerPoint.y - y);
        if (closestRaycast === null || dist < closestRaycast.hitDistance) {
          closestRaycast = {
            segment,
            hitPoint: innerPoint,
            hitDistance: dist,
            rayDir: { x: dirX, y: dirY },
            rayAngle: angle,
          };
        }
        if (farthestRaycast === null || dist > farthestRaycast.hitDistance) {
          farthestRaycast = {
            segment,
            hitPoint: innerPoint,
            hitDistance: dist,
            rayDir: { x: dirX, y: dirY },
            rayAngle: angle,
          };
        }
      }
      if (0 < trackWidth) {
        const outerPoint = segment.raycastBoundary(
          x,
          y,
          dirX,
          dirY,
          trackWidth
        );
        if (outerPoint) {
          const dist = Math.hypot(outerPoint.x - x, outerPoint.y - y);
          if (closestRaycast === null || dist < closestRaycast.hitDistance) {
            closestRaycast = {
              segment,
              hitPoint: outerPoint,
              hitDistance: dist,
              rayDir: { x: dirX, y: dirY },
              rayAngle: angle,
            };
          }
          if (farthestRaycast === null || dist > farthestRaycast.hitDistance) {
            farthestRaycast = {
              segment,
              hitPoint: outerPoint,
              hitDistance: dist,
              rayDir: { x: dirX, y: dirY },
              rayAngle: angle,
            };
          }
        }
      }
    }
  }
  return { closestRaycast, farthestRaycast };
}
