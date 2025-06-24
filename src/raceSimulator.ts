import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";
import { HorseTurnState } from "./types/raceLog";

export function runRaceSimulator(
  track: RaceTrack,
  horses: Horse[]
): HorseTurnState[] {
  const maxTurns = 60;
  const logs: HorseTurnState[] = [];
  const positions = horses.map(() => ({
    x: track.segments[0].start.x,
    y: track.segments[0].start.y,
    dist: 0,
  }));
  const pointCount = Math.max(1000, Math.round(track.totalLength));
  const trackPoints = track.getTrackPoints(pointCount);
  for (let turn = 0; turn < maxTurns; turn++) {
    for (let i = 0; i < horses.length; i++) {
      positions[i].dist += horses[i].speed;
      if (positions[i].dist > track.totalLength) {
        positions[i].dist = track.totalLength;
      }
      const t = positions[i].dist / track.totalLength;
      const idx = Math.min(
        trackPoints.length - 1,
        Math.floor(t * (trackPoints.length - 1))
      );
      positions[i].x = trackPoints[idx].x;
      positions[i].y = trackPoints[idx].y;
    }
    logs.push({
      turn,
      horses: positions.map((pos, idx) => ({
        id: horses[idx].id,
        name: horses[idx].name,
        x: pos.x,
        y: pos.y,
        dist: pos.dist,
      })),
    });
    if (positions.every((p) => p.dist >= track.totalLength)) {
      break;
    }
  }
  return logs;
}
