import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";

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
  const raceHorses: RaceHorse[] = horses.map((h, i) => {
    return new RaceHorse(h, segments, horses.length, i);
  });
  while (raceHorses.some((h) => !h.finished) && turn < maxTurns) {
    const horseStates: HorseTurnState[] = new Array(raceHorses.length);
    for (let i = 0; i < raceHorses.length; i++) {
      const horse = raceHorses[i];
      if (!horse.finished) {
        horse.moveOnTrack(tolerance);
        if (horse.lap >= totalLaps && horse.segmentIndex === 0) {
          horse.finished = true;
        }
      }
      horseStates[i] = {
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
    logs.push({ turn, horseStates } as RaceLog);
    turn++;
  }
  return logs;
}
