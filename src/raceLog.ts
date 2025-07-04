import { RaceSegment } from "./raceSegment";
import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";

export interface HorseTurnState {
  turn: number;
  horses: Array<{
    id: number;
    name: string;
    x: number;
    y: number;
    [key: string]: any;
  }>;
}

export function displayTrackInfo(track: RaceTrack) {
  console.log("=== 경기장 정보 ===");
  console.log(
    `트랙 크기: ${track.width.toFixed(1)} x ${track.height.toFixed(1)}`
  );
  console.log(
    `총 길이: ${track.totalLength}m (${(track.totalLength / 1000).toFixed(
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
  track: RaceTrack,
  horses: Horse[],
  logs: HorseTurnState[],
  targetRaceDistance: number,
  winner: Horse | null,
  minTurn: number
) {
  console.log("\n=== 경주 결과 ===");
  console.log(
    `경주 거리: ${targetRaceDistance}m (${
      targetRaceDistance / track.totalLength
    }바퀴)`
  );
  if (winner) {
    console.log(`🏆 우승마: ${winner.name}`);
    console.log(`   - ID: ${winner.id}`);
    console.log(`   - 속도: ${winner.speed.toFixed(2)}m/턴`);
    console.log(`   - 완주 턴: ${minTurn + 1}턴`);
    console.log(
      `   - 소요 시간: ${(
        (minTurn + 1) *
        (track.totalLength / winner.speed / track.totalLength)
      ).toFixed(1)}초 (가정)`
    );
  } else {
    console.log("❌ 우승마 없음 (모두 결승선 미도달)");
  }
  console.log("\n=== 전체 말 순위 ===");

  function findFinishTurn(
    logs: HorseTurnState[],
    horseId: number,
    targetDistance: number
  ): number | null {
    for (const log of logs) {
      for (const horse of log.horses) {
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
    const finishTurn = findFinishTurn(logs, horse.id, targetRaceDistance);
    const finalLog = logs[logs.length - 1];
    const finalPosition = findFinalPosition(finalLog.horses, horse.id);

    return {
      ...horse,
      finishTurn: finishTurn,
      finalDistance: finalPosition?.dist ?? 0,
    };
  }

  function compareHorseResults(a: any, b: any): number {
    if (a.finishTurn !== null && b.finishTurn !== null) {
      return a.finishTurn - b.finishTurn;
    }
    if (a.finishTurn !== null) return -1;
    if (b.finishTurn !== null) return 1;
    return b.finalDistance - a.finalDistance;
  }

  const horseResults: any[] = [];
  for (const horse of horses) {
    horseResults.push(mapHorseToResult(horse));
  }

  horseResults.sort(compareHorseResults);

  function displayHorseRank(horse: any, index: number): void {
    const status =
      horse.finishTurn !== null
        ? `완주 (${horse.finishTurn + 1}턴)`
        : `미완주 (${horse.finalDistance.toFixed(0)}m)`;
    console.log(
      `${index + 1}위: ${horse.name} - 속도: ${horse.speed.toFixed(
        2
      )}m/턴, ${status}`
    );
  }

  for (let i = 0; i < horseResults.length; i++) {
    displayHorseRank(horseResults[i], i);
  }
}
