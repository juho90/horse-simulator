import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { RacePathfinder } from "./racePathfinder";
import { RaceTrack } from "./raceTrack";

export function runRaceSimulator(
  track: RaceTrack,
  pathfinder: RacePathfinder,
  horses: RaceHorse[]
): RaceLog[] {
  const logs: RaceLog[] = [];
  let turn = 0;
  const maxTurns = 2000;
  while (horses.some((h) => !h.finished) && turn < maxTurns) {
    let horseStates: HorseTurnState[] = new Array(horses.length);
    let index = 0;
    for (; index < horses.length; index++) {
      const horse = horses[index];
      if (!horse.finished) {
        if (horse.checkRefreshPath(track, horses)) {
          const path = pathfinder.findPath(horse, horses);
          if (!path) {
            continue;
          }
          horse.refreshPath(track, path);
        }
        horse.moveOnTrack(turn, track, horses);
      }
      horseStates[index] = {
        id: horse.horseId,
        name: horse.name,
        x: horse.x,
        y: horse.y,
        heading: horse.raceHeading,
        speed: horse.speed,
        accel: horse.accel,
        stamina: horse.stamina,
        distance: horse.raceDistance,
        pathPoints: horse.path?.map((p) => ({ x: p.x, y: p.y })),
      };
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  return logs;
}
