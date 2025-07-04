import * as path from "path";
import { displayTrackInfo } from "./raceLog";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml as renderRaceWebGLHtml } from "./raceViewerWebGL";
import { Horse } from "./types/horse";

function getRandomTrackLength(): number {
  const min = 1200;
  const max = 3600;
  const step = 100;
  const count = (max - min) / step + 1;
  const idx = Math.floor(Math.random() * count);
  return min + idx * step;
}

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

function main() {
  const trackLength = getRandomTrackLength();
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const track = createTrack(trackLength, segmentCount);
  const targetRaceDistance = track.totalLength * 3;
  const horses = createHorses(10);
  const logs = runRaceSimulator(track, horses, track.totalLength * 3);
  let winner = null,
    minTurn = Infinity;

  function findFinishTurn(
    logs: any[],
    horseId: number,
    targetDistance: number
  ): number | undefined {
    for (const log of logs) {
      for (const horse of log.horses) {
        if (horse.id === horseId && horse.dist >= targetDistance) {
          return log.turn;
        }
      }
    }
    return undefined;
  }

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

main();
