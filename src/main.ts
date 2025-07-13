import * as path from "path";
import { displayTrackInfo, RaceLog } from "./raceLog";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml as renderRaceWebGLHtml } from "./raceViewerWebGL";
import { Horse } from "./types/horse";

function createHorses(count: number = 10): Horse[] {
  const horses: Horse[] = [];
  for (let i = 0; i < count; i++) {
    horses.push({
      id: i + 1,
      name: `Horse${i + 1}`,
      speed: 18 + Math.random() * 4,
    });
  }
  return horses;
}

function findFinishTurn(
  logs: RaceLog[],
  horseId: number,
  targetDistance: number
): number | undefined {
  for (const log of logs) {
    for (const horse of log.horseStates) {
      if (horse.id === horseId && horse.dist >= targetDistance) {
        return log.turn;
      }
    }
  }
  return undefined;
}

function main() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const track = createTrack(segmentCount);
  const targetRaceDistance = track.totalLength * 3;
  const horses = createHorses(10);
  const logs = runRaceSimulator(track, horses, track.totalLength * 3);
  let winner = null;
  let minTurn = Infinity;
  for (const horse of horses) {
    const finishTurn = findFinishTurn(logs, horse.id, targetRaceDistance);
    if (finishTurn !== undefined && finishTurn < minTurn) {
      minTurn = finishTurn;
      winner = horse;
    }
  }
  const outPath = path.resolve(__dirname, "../race-result.html");
  renderRaceWebGLHtml(outPath, logs, track);
  displayTrackInfo(track);
  // displayRaceResults(track, horses, logs, targetRaceDistance, winner, minTurn);
}

/*
const log = fs.readFileSync("raceline-log.json", { encoding: "utf-8" });
const raceCornerLog = JSON.parse(log) as RaceLineLog;
raycastNearBoundary(
  raceCornerLog.x,
  raceCornerLog.y,
  raceCornerLog.heading,
  new RaceLine(raceCornerLog.segment.start, raceCornerLog.segment.end),
  raceCornerLog.trackWidth,
  raceCornerLog.directions
);
*/

main();
