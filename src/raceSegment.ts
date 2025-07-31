import {
  addDirectionToAngle,
  DIRECTIONS,
  DirectionType,
} from "./directionalDistance";
import { Distance, EPSILON, NormalizeAngle, Vector2D } from "./raceMath";

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

  protected abstract calculateLength(): number;

  abstract getBounds(): BoundingBox;
  abstract getProgress(x: number, y: number): number;
  abstract getProgressAt(x: number, y: number): Vector2D;
  abstract getTangentDirectionAt(x: number, y: number): number;
  abstract getEndTangentDirection(): number;
  abstract getOrthoVectorAt(x: number, y: number): Vector2D;
  abstract getSampleNodes(
    trackWidth: number,
    resolution: number,
    padding: number
  ): RaceSegmentNode[];
  abstract isInner(x: number, y: number): boolean;
  abstract isEndAt(x: number, y: number): boolean;
  abstract raycastBoundary(
    rayPoint: Vector2D,
    rayDir: Vector2D,
    trackWidth: number
  ): Vector2D | null;
}

export enum GuardrailType {
  Inner = "inner",
  Outer = "outer",
}

export interface RaycastResult {
  segment: RaceSegment;
  hitPoint: Vector2D | null;
  hitDistance: number;
  rayDir: Vector2D;
  rayAngle: number;
  guardrailType: GuardrailType;
}

export function raycastBoundarys(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  trackWidth: number,
  directions: DirectionType[]
): RaycastResult[] {
  const point = { x, y };
  const closestRaycasts: RaycastResult[] = [];
  for (const direction of directions) {
    const angle = addDirectionToAngle(heading, direction);
    const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const innerPoint = segment.raycastBoundary(point, rayDir, 0);
    let innerDistance = Infinity;
    if (innerPoint) {
      innerDistance = Distance(innerPoint, point);
    }
    const closestRaycast = {
      segment,
      hitPoint: innerPoint,
      hitDistance: innerDistance,
      rayDir: rayDir,
      rayAngle: angle,
      guardrailType: GuardrailType.Inner,
    } as RaycastResult;
    closestRaycasts.push(closestRaycast);
    if (0 < trackWidth) {
      const outerPoint = segment.raycastBoundary(point, rayDir, trackWidth);
      let outerDistance = Infinity;
      if (outerPoint) {
        outerDistance = Distance(outerPoint, point);
      }
      const closestRaycast = {
        segment,
        hitPoint: outerPoint,
        hitDistance: outerDistance,
        rayDir: rayDir,
        rayAngle: angle,
        guardrailType: GuardrailType.Outer,
      } as RaycastResult;
      closestRaycasts.push(closestRaycast);
    }
  }
  return closestRaycasts;
}

export function raycastFarBoundary(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  trackWidth: number,
  directions: number[]
): RaycastResult | null {
  let farthestRaycast: RaycastResult | null = null;
  for (const offset of directions) {
    const angle = NormalizeAngle(heading + offset);
    const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const innerPoint = segment.raycastBoundary({ x, y }, rayDir, 0);
    let innerDistance = Infinity;
    if (innerPoint) {
      innerDistance = Distance(innerPoint, { x, y });
    }
    if (
      farthestRaycast === null ||
      innerDistance > farthestRaycast.hitDistance
    ) {
      farthestRaycast = {
        segment,
        hitPoint: innerPoint,
        hitDistance: innerDistance,
        rayDir: rayDir,
        rayAngle: angle,
        guardrailType: GuardrailType.Inner,
      };
    }
    if (0 < trackWidth) {
      const outerPoint = segment.raycastBoundary({ x, y }, rayDir, trackWidth);
      let outerDistance = Infinity;
      if (outerPoint) {
        outerDistance = Distance(outerPoint, { x, y });
      }
      if (
        farthestRaycast === null ||
        outerDistance > farthestRaycast.hitDistance
      ) {
        farthestRaycast = {
          segment,
          hitPoint: outerPoint,
          hitDistance: outerDistance,
          rayDir: rayDir,
          rayAngle: angle,
          guardrailType: GuardrailType.Outer,
        };
      }
    }
  }
  return farthestRaycast;
}

export const TRACK_WIDTH = 200;

export function raycastBoundary(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  nextSegment: RaceSegment
): RaycastResult[] {
  let closestRaycasts = raycastBoundarys(
    x,
    y,
    heading,
    segment,
    TRACK_WIDTH,
    DIRECTIONS
  );
  const nextClosestRaycasts = raycastBoundarys(
    x,
    y,
    heading,
    nextSegment,
    TRACK_WIDTH,
    DIRECTIONS
  );
  closestRaycasts.push(...nextClosestRaycasts);
  return closestRaycasts;
}

export function findNearRaycast(
  angle: number,
  raycasts: RaycastResult[]
): RaycastResult | null {
  let closest: RaycastResult | null = null;
  let minDiff = Infinity;
  let minDistance = Infinity;
  for (const raycast of raycasts) {
    const diff = NormalizeAngle(raycast.rayAngle - angle);
    if (diff < 0 || EPSILON < diff) {
      continue;
    }
    if (diff < minDiff) {
      closest = raycast;
      minDiff = diff;
      minDistance = raycast.hitDistance;
    } else if (diff <= minDiff && raycast.hitDistance < minDistance) {
      closest = raycast;
      minDiff = diff;
      minDistance = raycast.hitDistance;
    }
  }
  return closest;
}
