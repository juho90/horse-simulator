import * as path from "path";
import { createSampleHorses } from "./horse";
import { PerformanceMonitor } from "./performanceMonitor";
import { displayRaceResults, displayTrackInfo } from "./raceLog";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml, testRaceWebGL } from "./raceViewerWebGL";

async function runAnalysisMode() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const track = createTrack(segmentCount);
  const horses = createSampleHorses();
  const monitor = new PerformanceMonitor();
  await monitor.runRaceWithAnalysis(track, horses);
}

function runSimulateMode() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const track = createTrack(segmentCount);
  const horses = createSampleHorses();
  const logs = runRaceSimulator(track, horses);
  const htmlString = generateRaceWebGLHtml(track, logs);
  const outPath = path.resolve(__dirname, "../race-result.html");
  testRaceWebGL(outPath, htmlString);
  displayTrackInfo(track);
  displayRaceResults(horses, logs, track.raceLength);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--analysis") || args.includes("-a")) {
    await runAnalysisMode();
  } else {
    runSimulateMode();
  }
}

main().catch(console.error);
