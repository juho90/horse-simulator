import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceLine } from "./raceLine";
import {
  HorseTurnState,
  RaceLog,
  saveRaceCornerLogToFile,
  saveRaceLineLogToFile,
} from "./raceLog";
import { Vector2D } from "./raceMath";
import { RaceSegment } from "./raceSegment";
import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";

export interface RaycastResult {
  segment: RaceSegment;
  hitPoint: Vector2D;
  hitDistance: number;
  rayDir: Vector2D;
  rayAngle: number;
}

export function raycastNearBoundary(
  x: number,
  y: number,
  heading: number,
  segment: RaceSegment,
  trackWidth: number,
  directions: number[]
): RaycastResult | null {
  let closestRaycast: RaycastResult | null = null;
  for (const offset of directions) {
    const angle = heading + offset;
    const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const innerPoint = segment.raycastBoundary({ x, y }, rayDir, 0);
    if (innerPoint) {
      const dist = Math.hypot(innerPoint.x - x, innerPoint.y - y);
      if (closestRaycast === null || dist < closestRaycast.hitDistance) {
        closestRaycast = {
          segment,
          hitPoint: innerPoint,
          hitDistance: dist,
          rayDir: rayDir,
          rayAngle: angle,
        };
      }
    }
    if (0 < trackWidth) {
      const outerPoint = segment.raycastBoundary({ x, y }, rayDir, trackWidth);
      if (outerPoint) {
        const dist = Math.hypot(outerPoint.x - x, outerPoint.y - y);
        if (closestRaycast === null || dist < closestRaycast.hitDistance) {
          closestRaycast = {
            segment,
            hitPoint: outerPoint,
            hitDistance: dist,
            rayDir: rayDir,
            rayAngle: angle,
          };
        }
      }
    }
  }
  return closestRaycast;
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
          };
        }
      }
    }
  }
  return farthestRaycast;
}

const DIRECTIONS = [
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
  nextSegment: RaceSegment,
  trackWidth: number
): {
  closestRaycast: RaycastResult | null;
  farthestRaycast: RaycastResult | null;
} {
  let closestRaycast = raycastNearBoundary(
    x,
    y,
    heading,
    segment,
    trackWidth,
    DIRECTIONS
  );
  if (!closestRaycast) {
    const nextClosestRaycast = raycastNearBoundary(
      x,
      y,
      heading,
      nextSegment,
      trackWidth,
      DIRECTIONS
    );
    if (nextClosestRaycast) {
      closestRaycast = nextClosestRaycast;
    } else {
      if (!closestRaycast) {
        if (segment.type === "line") {
          for (const offset of DIRECTIONS) {
            const angle = heading + offset;
            const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
            console.log(
              `[raycastNearBoundary] no outerPoint: x=${x}, y=${y}, angle=${angle.toFixed(
                3
              )}, rayDir=(${rayDir.x.toFixed(3)}, ${rayDir.y.toFixed(
                3
              )}), segmentType=${segment.type}, segmentPoint (${
                segment.start.x
              }, ${segment.start.y}) to (${segment.end.x}, ${
                segment.end.y
              }), trackWidth=${trackWidth}`
            );
          }
          saveRaceLineLogToFile({
            x,
            y,
            heading,
            segment: segment as RaceLine,
            trackWidth,
            directions: DIRECTIONS,
          });
        } else if (segment.type === "corner") {
          saveRaceCornerLogToFile({
            x,
            y,
            heading,
            segment: segment as RaceCorner,
            trackWidth,
            directions: DIRECTIONS,
          });
        }
        throw new Error("No closest raycast found");
      }
    }
  }
  let farthestRaycast = raycastFarBoundary(x, y, heading, segment, trackWidth, [
    0,
  ]);
  if (!farthestRaycast) {
    const nextFarthestRaycast = raycastFarBoundary(
      x,
      y,
      heading,
      nextSegment,
      trackWidth,
      [0]
    );
    if (nextFarthestRaycast) {
      farthestRaycast = nextFarthestRaycast;
    }
  }
  return { closestRaycast, farthestRaycast };
}

export function runRaceSimulator(
  track: RaceTrack,
  horses: Horse[],
  raceDistance?: number
): RaceLog[] {
  const tolerance = 20;
  const logs: RaceLog[] = [];
  const totalLaps = Math.ceil(
    (raceDistance ?? track.totalLength) / track.totalLength
  );
  let turn = 0;
  const maxTurns = 300;
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
          horse.moveOnTrack(tolerance);
          if (horse.lap >= totalLaps && horse.segmentIndex === 0) {
            horse.finished = true;
          }
        }
        horseStates[index] = {
          id: horse.id,
          name: horse.name,
          x: horse.x,
          y: horse.y,
          speed: horse.speed,
          dist: horse.distance,
          closestHitPoint: horse.closestRaycast?.hitPoint,
          farthestHitPoint: horse.farthestRaycast?.hitPoint,
        };
      }
    } catch (error) {
      console.error(`Error in turn ${turn}:`, error);
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
