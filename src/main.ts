import * as path from "path";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml as renderRaceWebGLHtml } from "./raceViewerWebGL";
import { Horse } from "./types/horse";

function getRandomTrackLength(): number {
  const min = 1200,
    max = 3600,
    step = 100;
  const count = (max - min) / step + 1;
  const idx = Math.floor(Math.random() * count);
  return min + idx * step;
}

function createHorses(count: number = 10): Horse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Horse${i + 1}`,
    speed: 18 + Math.random() * 4, // 18~22 m/턴
  }));
}

function main() {
  const trackLength = getRandomTrackLength();
  const track = createTrack(trackLength);
  const horses = createHorses(10);
  const logs = runRaceSimulator(track, horses);
  let winner = null,
    minTurn = Infinity;
  for (const horse of horses) {
    const finishTurn = logs.find((l) =>
      l.horses.find((h) => h.id === horse.id && h.dist >= track.totalLength)
    )?.turn;
    if (finishTurn !== undefined && finishTurn < minTurn) {
      minTurn = finishTurn;
      winner = horse;
    }
  }
  const outPath = path.resolve(__dirname, "../race-result.html");
  renderRaceWebGLHtml(outPath, logs, track);
  console.log(`트랙 길이: ${trackLength}m`);
  if (winner) {
    console.log(
      `우승마: ${winner.name} (id=${winner.id}, speed=${winner.speed.toFixed(
        2
      )} m/턴)`
    );
    console.log(`우승 턴: ${minTurn + 1}`);
  } else {
    console.log("우승마 없음 (모두 결승선 미도달)");
  }
}

main();
