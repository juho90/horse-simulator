import { Point, RaceSegment } from "./raceSegment";

/**
 * 경주마 위치(x, y)에서 segments의 내측/외곽 경계까지 최단 거리와 방향(angle, dirX, dirY, 교차점)을 반환
 * boundary: "inner" | "outer"
 * trackWidth: 외곽 경계용 트랙 폭
 * angleStep: 각도 샘플링 단위(도)
 */
export function findNearestBoundaryDirection(
  x: number,
  y: number,
  segments: RaceSegment[],
  boundary: "inner" | "outer" = "inner",
  trackWidth: number = 40,
  angleStep: number = 10
): {
  minDist: number;
  bestAngle: number;
  bestDir: { x: number; y: number };
  bestPoint: Point | null;
} {
  let minDist = Infinity,
    bestAngle = 0,
    bestDir = { x: 1, y: 0 },
    bestPoint: Point | null = null;
  for (let angle = 0; angle < 360; angle += angleStep) {
    const rad = (angle * Math.PI) / 180;
    const dirX = Math.cos(rad),
      dirY = Math.sin(rad);
    for (const seg of segments) {
      const pt = seg.raycastBoundary(x, y, dirX, dirY, boundary, trackWidth);
      if (pt) {
        const dist = Math.hypot(pt.x - x, pt.y - y);
        if (dist < minDist) {
          minDist = dist;
          bestAngle = angle;
          bestDir = { x: dirX, y: dirY };
          bestPoint = pt;
        }
      }
    }
  }
  return { minDist, bestAngle, bestDir, bestPoint };
}

/**
 * 경주마 heading 기준으로 전방, 전방 대각선(좌/우), 좌/우 방향의 경계까지 최단 거리와 방향(angle, dirX, dirY, 교차점)을 반환
 * heading: 현재 경주마 방향(라디안)
 * directions: 검사할 각도 오프셋 배열(라디안)
 */
export function findBoundaryDirections(
  x: number,
  y: number,
  heading: number,
  segments: RaceSegment[],
  boundary: "inner" | "outer" = "inner",
  trackWidth: number = 40,
  directions: number[] = [
    0,
    Math.PI / 4,
    -Math.PI / 4,
    Math.PI / 2,
    -Math.PI / 2,
  ]
): Array<{
  angle: number;
  dir: { x: number; y: number };
  dist: number;
  point: Point | null;
}> {
  const results = [];
  for (const offset of directions) {
    const angle = heading + offset;
    const dirX = Math.cos(angle),
      dirY = Math.sin(angle);
    let minDist = Infinity,
      bestPoint: Point | null = null;
    for (const seg of segments) {
      const pt = seg.raycastBoundary(x, y, dirX, dirY, boundary, trackWidth);
      if (pt) {
        const dist = Math.hypot(pt.x - x, pt.y - y);
        if (dist < minDist) {
          minDist = dist;
          bestPoint = pt;
        }
      }
    }
    results.push({
      angle,
      dir: { x: dirX, y: dirY },
      dist: minDist,
      point: bestPoint,
    });
  }
  return results;
}
