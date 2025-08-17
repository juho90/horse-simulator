import * as path from "path";
import { RaceHorse } from "./raceHorse";
import { createSampleHorses } from "./raceHorseStatus";
import { RaceMonitor } from "./raceMonitor";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { RaceTracker } from "./raceTracker";
import { generateRaceWebGLHtml, testRaceWebGL } from "./raceViewer";

async function runSimulateMode() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const raceTrack = createTrack(segmentCount);
  const horses = createSampleHorses();
  const raceTracker = new RaceTracker(raceTrack);
  const gateNodes = raceTracker.getGateNodes();
  const raceHorses: RaceHorse[] = horses.map((horse, index) => {
    return new RaceHorse(horse, gateNodes[index]);
  });
  const logs = runRaceSimulator(raceTracker, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, raceTracker, logs);
  const outPath = path.resolve(__dirname, "../race-result.html");
  testRaceWebGL(outPath, htmlString);
  const monitor = new RaceMonitor();
  await monitor.saveInitialRaceState(raceTrack, horses);
}

async function runReSimulateMode() {
  const monitor = new RaceMonitor();
  const { track: raceTrack, horses } = await monitor.loadInitialRaceState();
  const raceTracker = new RaceTracker(raceTrack);
  const gateNodes = raceTracker.getGateNodes();
  const raceHorses: RaceHorse[] = horses.map((horse, index) => {
    return new RaceHorse(horse, gateNodes[index]);
  });
  const logs = runRaceSimulator(raceTracker, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, raceTracker, logs);
  const outPath = path.resolve(__dirname, "../race-result-replay.html");
  testRaceWebGL(outPath, htmlString);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--replay") || args.includes("-r")) {
    await runReSimulateMode();
  } else {
    await runSimulateMode();
  }
}

main().catch(console.error);
