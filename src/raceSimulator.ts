import { RaceHorse } from "./raceHorse";
import { RaceTrack } from "./raceTrack";
import { RaceTrackNode } from "./raceTrackNode";
import { HorseTurnState, RaceLog } from "./raceViewer";

export function runRaceSimulator(
  track: RaceTrack,
  pathfinder: RaceTrackNode,
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
        horse.moveOnTrack(turn, pathfinder, horses);
      }
      const horseState = {
        id: horse.horseId,
        name: horse.name,
        x: horse.x,
        y: horse.y,
        speed: horse.speed,
        accel: horse.accel,
        stamina: horse.stamina,
        distance: horse.raceDistance,
        pathPoints: horse.path?.map((p) => ({ x: p.x, y: p.y })),
      } as HorseTurnState;
      horseStates[index] = horseState;
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  return logs;
}
