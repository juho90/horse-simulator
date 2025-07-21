import { DirectionType } from "./directionalDistance";
import { NearbyHorse, RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

const PREDICT_TIME = 0.3;
const COLLISION_DIST = 2.0;
const MIN_HORSE_DIST = 3.0;
const MIN_RAIL_DIST = 1.5;
const MAX_STEER_RAD = 0.4;
const LANE_ANGLE = Math.PI / 12;

type LaneDecision = -1 | 0 | 1;

export function nextGenAvoidance(
  horse: RaceHorse,
  raceEnv: RaceEnvironment,
  raceAnalysis: RaceSituationAnalysis
): number {
  const trackDirection = horse.segment.getTangentDirectionAt(horse.x, horse.y);
  const dirDistances = raceAnalysis.dirDistanceWithSource;
  if (!dirDistances) return trackDirection;

  // 가드레일/트랙 경계 근접 시 무조건 반대 방향으로 강제 조향
  if (dirDistances.left.distance < 2.5) {
    // 왼쪽 레일이 매우 가까우면 강하게 오른쪽으로 조향
    return Math.min(
      MAX_STEER_RAD,
      trackDirection + LANE_ANGLE - horse.raceHeading
    );
  }
  if (dirDistances.right.distance < 2.5) {
    // 오른쪽 레일이 매우 가까우면 강하게 왼쪽으로 조향
    return Math.max(
      -MAX_STEER_RAD,
      trackDirection - LANE_ANGLE - horse.raceHeading
    );
  }

  // 그 외에는 트랙 방향 유지
  const headingDiff = normalizeAngle(trackDirection - horse.raceHeading);
  return Math.max(-MAX_STEER_RAD, Math.min(headingDiff, MAX_STEER_RAD));
}

function isImminentCollision(
  horse: RaceHorse,
  nearbyHorses: NearbyHorse,
  predictTime: number,
  collisionDist: number
): boolean {
  const myFutureX =
    horse.x + horse.speed * Math.cos(horse.raceHeading) * predictTime;
  const myFutureY =
    horse.y + horse.speed * Math.sin(horse.raceHeading) * predictTime;
  const nearbyHorseArray = [
    { direction: DirectionType.FRONT, horse: nearbyHorses.front },
    { direction: DirectionType.LEFT, horse: nearbyHorses.left },
    { direction: DirectionType.RIGHT, horse: nearbyHorses.right },
  ];
  for (const nearbyHorse of nearbyHorseArray) {
    const oppHorse = nearbyHorse.horse;
    if (!oppHorse) {
      continue;
    }
    const oppFutureX =
      oppHorse.x +
      oppHorse.speed * Math.cos(oppHorse.raceHeading) * predictTime;
    const oppFutureY =
      oppHorse.y +
      oppHorse.speed * Math.sin(oppHorse.raceHeading) * predictTime;
    const dx = myFutureX - oppFutureX;
    const dy = myFutureY - oppFutureY;
    if (Math.sqrt(dx * dx + dy * dy) < collisionDist) {
      return true;
    }
  }
  return false;
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) {
    angle -= 2 * Math.PI;
  }
  while (angle < -Math.PI) {
    angle += 2 * Math.PI;
  }
  return angle;
}
