import * as path from "path";
import { createSampleHorses } from "./horse";
import { PerformanceMonitor } from "./performanceMonitor";
import { RaceHorse } from "./raceHorse";
import { displayRaceResults, displayTrackInfo } from "./raceLog";
import { RacePathfinder } from "./racePathfinder";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml, testRaceWebGL } from "./raceViewerWebGL";

async function runReSimulateMode() {
  const monitor = new PerformanceMonitor();
  const { track: raceTrack, horses } = await monitor.loadInitialRaceState();
  const firstSegment = raceTrack.getFirstSegment();
  const racePathfinder = new RacePathfinder(raceTrack);
  const raceHorses: RaceHorse[] = horses.map((horse, gate) => {
    return new RaceHorse(horse, gate, firstSegment);
  });
  const logs = runRaceSimulator(raceTrack, racePathfinder, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, racePathfinder, logs);
  const outPath = path.resolve(__dirname, "../race-result-replay.html");
  testRaceWebGL(outPath, htmlString);
}

function runSimulateMode() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const raceTrack = createTrack(segmentCount);
  const horses = createSampleHorses();
  const firstSegment = raceTrack.getFirstSegment();
  const racePathfinder = new RacePathfinder(raceTrack);
  const raceHorses: RaceHorse[] = horses.map((horse, gate) => {
    return new RaceHorse(horse, gate, firstSegment);
  });
  const logs = runRaceSimulator(raceTrack, racePathfinder, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, racePathfinder, logs);
  const outPath = path.resolve(__dirname, "../race-result.html");
  testRaceWebGL(outPath, htmlString);
  displayTrackInfo(raceTrack);
  displayRaceResults(horses, logs, raceTrack.raceLength);
  const monitor = new PerformanceMonitor();
  monitor.saveInitialRaceState(raceTrack, horses);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--replay") || args.includes("-r")) {
    await runReSimulateMode();
  } else {
    runSimulateMode();
  }
}

main().catch(console.error);
