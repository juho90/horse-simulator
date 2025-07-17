import * as fs from "fs";
import { Horse } from "./horse";
import { RaceCorner } from "./raceCorner";
import { RaceLine } from "./raceLine";
import { Vector2D } from "./raceMath";
import { RaceSegment } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface HorseTurnState {
  id: number;
  name: string;
  x: number;
  y: number;
  speed: number;
  accel: number;
  stamina: number;
  dist: number;
  closestHitPoints?: Vector2D[];
  farthestHitPoint?: Vector2D;
}

export interface RaceLog {
  turn: number;
  horseStates: HorseTurnState[];
}

export function displayTrackInfo(track: RaceTrack) {
  console.log("=== 경기장 정보 ===");
  console.log(
    `트랙 크기: ${track.width.toFixed(1)} x ${track.height.toFixed(1)}`
  );
  console.log(
    `총 길이: ${track.trackLength}m (${(track.trackLength / 1000).toFixed(
      1
    )}km)`
  );
  console.log(`세그먼트 수: ${track.segments.length}개`);

  function getSegmentType(s: RaceSegment): string {
    return s.type;
  }

  const segmentTypes: string[] = [];
  for (const segment of track.segments) {
    segmentTypes.push(getSegmentType(segment));
  }
  console.log(`패턴: ${segmentTypes.join(" -> ")}`);

  const lineSegments: RaceSegment[] = [];
  const cornerSegments: RaceSegment[] = [];

  for (const segment of track.segments) {
    if (segment.type === "line") {
      lineSegments.push(segment);
    } else if (segment.type === "corner") {
      cornerSegments.push(segment);
    }
  }

  function getSegmentLength(s: RaceSegment): number {
    return s.length;
  }

  const lineLengths: number[] = [];
  for (const segment of lineSegments) {
    lineLengths.push(getSegmentLength(segment));
  }

  const cornerLengths: number[] = [];
  for (const segment of cornerSegments) {
    cornerLengths.push(getSegmentLength(segment));
  }

  console.log(
    `직선 구간: ${lineSegments.length}개 (${lineLengths.join("m, ")}m)`
  );
  console.log(
    `코너 구간: ${cornerSegments.length}개 (${cornerLengths.join("m, ")}m)`
  );
}

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
    console.log(`Race log saved to ${"raceline-log.json"}`);
  } catch (err) {
    console.error("Failed to save race log:", err);
  }
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
    console.log(`Race log saved to ${"racecorner-log.json"}`);
  } catch (err) {
    console.error("Failed to save race log:", err);
  }
}
