import { Horse } from "./horse";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { Vector2D } from "./raceMath";
import { RaceSegment } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface RaycastResult {
  segment: RaceSegment;
  hitPoint: Vector2D;
  hitDistance: number;
  rayDir: Vector2D;
  rayAngle: number;
  angle: number;
}

export function raycastBoundarys(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  trackWidth: number,
  directions: number[]
): RaycastResult[] {
  const closestRaycasts: RaycastResult[] = [];
  for (const offset of directions) {
    const angle = heading + offset;
    const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const innerPoint = segment.raycastBoundary({ x, y }, rayDir, 0);
    if (innerPoint) {
      const distance = Math.hypot(innerPoint.x - x, innerPoint.y - y);
      const closestRaycast = {
        segment,
        hitPoint: innerPoint,
        hitDistance: distance,
        rayDir: rayDir,
        rayAngle: angle,
        angle: angle,
      } as RaycastResult;
      closestRaycasts.push(closestRaycast);
    }
    if (0 < trackWidth) {
      const outerPoint = segment.raycastBoundary({ x, y }, rayDir, trackWidth);
      if (outerPoint) {
        const dist = Math.hypot(outerPoint.x - x, outerPoint.y - y);
        const closestRaycast = {
          segment,
          hitPoint: outerPoint,
          hitDistance: dist,
          rayDir: rayDir,
          rayAngle: angle,
          angle: angle,
        } as RaycastResult;
        closestRaycasts.push(closestRaycast);
      }
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
    const angle = heading + offset;
    const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const innerPoint = segment.raycastBoundary({ x, y }, rayDir, 0);
    if (innerPoint) {
      const dist = Math.hypot(innerPoint.x - x, innerPoint.y - y);
      if (farthestRaycast === null || dist > farthestRaycast.hitDistance) {
        farthestRaycast = {
          segment,
          hitPoint: innerPoint,
          hitDistance: dist,
          rayDir: rayDir,
          rayAngle: angle,
          angle: angle,
        };
      }
    }
    if (0 < trackWidth) {
      const outerPoint = segment.raycastBoundary({ x, y }, rayDir, trackWidth);
      if (outerPoint) {
        const dist = Math.hypot(outerPoint.x - x, outerPoint.y - y);
        if (farthestRaycast === null || dist > farthestRaycast.hitDistance) {
          farthestRaycast = {
            segment,
            hitPoint: outerPoint,
            hitDistance: dist,
            rayDir: rayDir,
            rayAngle: angle,
            angle: angle,
          };
        }
      }
    }
  }
  return farthestRaycast;
}

export const TRACK_WIDTH = 200;

export const DIRECTIONS = [
  -Math.PI / 2,
  -Math.PI / 3,
  -Math.PI / 6,
  0,
  Math.PI / 6,
  Math.PI / 3,
  Math.PI / 2,
];

export function raycastBoundary(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  nextSegment: RaceSegment
): {
  closestRaycasts: RaycastResult[];
  farthestRaycast: RaycastResult | null;
} {
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
  let farthestRaycast = raycastFarBoundary(
    x,
    y,
    heading,
    segment,
    TRACK_WIDTH,
    [0]
  );
  if (!farthestRaycast) {
    const nextFarthestRaycast = raycastFarBoundary(
      x,
      y,
      heading,
      nextSegment,
      TRACK_WIDTH,
      [0]
    );
    if (nextFarthestRaycast) {
      farthestRaycast = nextFarthestRaycast;
    }
  }
  return { closestRaycasts, farthestRaycast };
}

export function runRaceSimulator(track: RaceTrack, horses: Horse[]): RaceLog[] {
  const logs: RaceLog[] = [];
  let turn = 0;
  const maxTurns = 2000;
  const segments = track.segments || [];
  const raceHorses: RaceHorse[] = horses.map((horse, gate) => {
    return new RaceHorse(horse, segments, gate);
  });
  while (raceHorses.some((h) => !h.finished) && turn < maxTurns) {
    let horseStates: HorseTurnState[] = new Array(raceHorses.length);
    let index = 0;
    try {
      for (; index < raceHorses.length; index++) {
        const horse = raceHorses[index];
        if (!horse.finished) {
          horse.moveOnTrack(turn, raceHorses);
          if (track.isGoal(horse)) {
            horse.finished = true;
          }
        }
        horseStates[index] = {
          id: horse.horseId,
          name: horse.name,
          x: horse.x,
          y: horse.y,
          speed: horse.speed,
          accel: horse.accel,
          stamina: horse.stamina,
          dist: horse.raceDistance,
          closestHitPoints: horse.raceEnvironment.closestRaycasts?.map(
            (r) => r.hitPoint
          ),
          farthestHitPoint: horse.raceEnvironment.farthestRaycast?.hitPoint,
        };
      }
    } catch (error) {
      for (const horse of raceHorses) {
        horse.finished = true;
      }
      if (index != horseStates.length) {
        horseStates = horseStates.slice(0, index - 1);
      }
    }
    logs.push({ turn, horseStates } as RaceLog);
    turn++;
  }
  return logs;
}
