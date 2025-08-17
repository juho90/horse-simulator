import { RaceHorse } from "./raceHorse";
import { RaceTracker } from "./raceTracker";
import { HorseTurnState, RaceLog } from "./raceViewer";

export function runRaceSimulator(
  raceTracker: RaceTracker,
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
        horse.moveOnTrack(turn, raceTracker, horses);
      }
      const horseState = {
        id: horse.getHorseId(),
        name: horse.getHorseName(),
        x: horse.x,
        y: horse.y,
        speed: horse.getHorseSpeed(),
        accel: horse.getHorseAccel(),
        stamina: horse.getHorseStamina(),
        distance: horse.raceDistance,
        pathPoints: [], // for debug: horse.path?.map((p) => ({ x: p.x, y: p.y })),
      } as HorseTurnState;
      horseStates[index] = horseState;
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  return logs;
}
