import * as fs from "fs";
import { Horse } from "./horse";
import { RaceCorner } from "./raceCorner";
import { RaceLine } from "./raceLine";
import { Vector2D } from "./raceMath";
import { RaceTrack } from "./raceTrack";

export interface HorseTurnState {
  id: number;
  name: string;
  x: number;
  y: number;
  heading: number;
  speed: number;
  accel: number;
  stamina: number;
  dist: number;
  closestHitPoints: Vector2D[] | null;
}

export interface RaceLog {
  turn: number;
  horseStates: HorseTurnState[];
}

export function displayTrackInfo(track: RaceTrack) {}

export function displayRaceResults(
  horses: Horse[],
  logs: RaceLog[],
  targetRaceDistance: number
) {
  function findFinishTurn(
    logs: RaceLog[],
    horseId: number,
    targetDistance: number
  ): number | null {
    for (const log of logs) {
      for (const horse of log.horseStates) {
        if (horse.id === horseId && horse.dist >= targetDistance) {
          return log.turn;
        }
      }
    }
    return null;
  }

  function findFinalPosition(horses: any[], horseId: number): any {
    for (const horse of horses) {
      if (horse.id === horseId) {
        return horse;
      }
    }
    return null;
  }

  function mapHorseToResult(horse: Horse): any {
    const finishTurn = findFinishTurn(logs, horse.horseId, targetRaceDistance);
    const finalLog = logs[logs.length - 1];
    const finalPosition = findFinalPosition(
      finalLog.horseStates,
      horse.horseId
    );

    return {
      ...horse,
      finishTurn: finishTurn,
      finalDistance: finalPosition?.dist ?? 0,
    };
  }

  const horseResults: any[] = [];
  for (const horse of horses) {
    horseResults.push(mapHorseToResult(horse));
  }
}

export interface RaceLineLog {
  x: number;
  y: number;
  heading: number;
  segment: RaceLine;
  trackWidth: number;
  directions: number[];
}

export function saveRaceLineLogToFile(raceLine: RaceLineLog) {
  try {
    fs.writeFileSync(
      "raceline-log.json",
      JSON.stringify(raceLine, null, 2),
      "utf-8"
    );
  } catch (err) {}
}

export interface RaceCornerLog {
  x: number;
  y: number;
  heading: number;
  segment: RaceCorner;
  trackWidth: number;
  directions: number[];
}

export function saveRaceCornerLogToFile(raceCorner: RaceCornerLog) {
  try {
    fs.writeFileSync(
      "racecorner-log.json",
      JSON.stringify(raceCorner, null, 2),
      { encoding: "utf-8" }
    );
  } catch (err) {}
}
