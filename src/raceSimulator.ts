import { RaceHorse } from "./raceHorse";
import { RaceTrack } from "./raceTrack";
import { RaceTracker } from "./raceTracker";
import { HorseTurnState, RaceLog } from "./raceViewer";

export function runRaceSimulator(
  raceTrack: RaceTrack,
  raceTracker: RaceTracker,
  raceHorses: RaceHorse[]
): { finishedHorses: number[]; logs: RaceLog[] } {
  const finishedHorses: number[] = [];
  const logs: RaceLog[] = [];
  let turn = 0;
  const maxTurns = 2000;
  let lastSpurt = false;
  if (turn === 0) {
    let horseStates: HorseTurnState[] = new Array(raceHorses.length);
    for (let index = 0; index < raceHorses.length; index++) {
      const raceHorse = raceHorses[index];
      const horseState = {
        id: raceHorse.getHorseId(),
        name: raceHorse.getHorseName(),
        x: raceHorse.x,
        y: raceHorse.y,
        speed: raceHorse.getHorseSpeed(),
        accel: raceHorse.getHorseAccel(),
        stamina: raceHorse.getHorseStamina(),
        distance: raceHorse.raceDistance,
        pathPoints: [], // for debug: horse.path?.map((p) => ({ x: p.x, y: p.y })),
      } as HorseTurnState;
      horseStates[index] = horseState;
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  while (finishedHorses.length < raceHorses.length && turn < maxTurns) {
    let horseStates: HorseTurnState[] = new Array(raceHorses.length);
    let index = 0;
    for (; index < raceHorses.length; index++) {
      const raceHorse = raceHorses[index];
      if (!raceTrack.isFinished(raceHorse)) {
        raceHorse.moveOnTrack(turn, lastSpurt, raceTracker, raceHorses);
        if (raceTrack.isFinished(raceHorse)) {
          finishedHorses.push(raceHorse.getHorseId());
        }
      }
      const horseState = {
        id: raceHorse.getHorseId(),
        name: raceHorse.getHorseName(),
        x: raceHorse.x,
        y: raceHorse.y,
        speed: raceHorse.getHorseSpeed(),
        accel: raceHorse.getHorseAccel(),
        stamina: raceHorse.getHorseStamina(),
        distance: raceHorse.raceDistance,
        pathPoints: [], // for debug: horse.path?.map((p) => ({ x: p.x, y: p.y })),
      } as HorseTurnState;
      horseStates[index] = horseState;
    }
    if (!lastSpurt) {
      for (const raceHorse of raceHorses) {
        if (raceTrack.isLastSpurt(raceHorse)) {
          lastSpurt = true;
          break;
        }
      }
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  return { finishedHorses, logs };
}
