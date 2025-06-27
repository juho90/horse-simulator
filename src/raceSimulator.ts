import { HorseTurnState } from "./raceLog";
import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";

export function runRaceSimulator(
  track: RaceTrack,
  horses: Horse[],
  raceDistance?: number
): HorseTurnState[] {
  const points = track.getTrackPoints(3000);
  const logs: HorseTurnState[] = [];
  const positions = horses.map((h) => ({
    id: h.id,
    name: h.name,
    speed: h.speed,
    dist: 0,
    x: points[0].x,
    y: points[0].y,
  }));
  raceDistance ??= track.totalLength;
  let turn = 0;
  while (positions.some((pos) => pos.dist < raceDistance)) {
    for (let i = 0; i < horses.length; i++) {
      if (positions[i].dist < raceDistance) {
        positions[i].dist += horses[i].speed;
        if (positions[i].dist > raceDistance) {
          positions[i].dist = raceDistance;
        }
        const currentPositionInLap = positions[i].dist % track.totalLength;
        const t = currentPositionInLap / track.totalLength;
        const idx = Math.floor(t * (points.length - 1));
        positions[i].x = points[idx].x;
        positions[i].y = points[idx].y;
      }
    }
    logs.push({
      turn,
      horses: positions.map((p) => ({
        id: p.id,
        name: p.name,
        speed: p.speed,
        dist: p.dist,
        x: p.x,
        y: p.y,
      })),
    });
    turn++;
  }
  return logs;
}
