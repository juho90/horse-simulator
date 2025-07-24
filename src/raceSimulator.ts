import { Horse } from "./horse";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { Vector2D } from "./raceMath";
import { RaceTrack } from "./raceTrack";

export function runRaceSimulator(track: RaceTrack, horses: Horse[]): RaceLog[] {
  const logs: RaceLog[] = [];
  let turn = 0;
  const maxTurns = 2000;
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
          horse.moveOnTrack(turn, raceHorses);
          if (track.isGoal(horse)) {
            horse.finished = true;
          }
        }
        const closestHitPoints: Vector2D[] = [];
        if (horse.raceEnv.closestRaycasts) {
          for (const raycast of horse.raceEnv.closestRaycasts) {
            if (!raycast.hitPoint) {
              continue;
            }
            closestHitPoints.push(raycast.hitPoint);
          }
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
          dist: horse.raceDistance,
          closestHitPoints: closestHitPoints,
        };
      }
    } catch (error) {
      for (const horse of raceHorses) {
        horse.finished = true;
      }
      if (index != horseStates.length) {
        horseStates = horseStates.slice(0, index - 1);
      }
    }
    logs.push({ turn, horseStates });
    turn++;
  }
  return logs;
}
