import * as path from "path";
import { createSampleHorses } from "./horse";
import { RaceHorse } from "./raceHorse";
import { RaceMonitor } from "./raceMonitor";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { RaceTrackNode } from "./raceTrackNode";
import { generateRaceWebGLHtml, testRaceWebGL } from "./raceViewer";
import { saveTrackPNG } from "./saveTrackPNG";

async function runSimulateMode() {
  const segmentCount = Math.floor(Math.random() * 12) + 6;
  const raceTrack = createTrack(segmentCount);
  const horses = createSampleHorses();
  const raceTrackNode = new RaceTrackNode(raceTrack);
  const gateNodes = raceTrackNode.getGateNodes();
  const raceHorses: RaceHorse[] = [horses[0]].map((horse, index) => {
    return new RaceHorse(horse, gateNodes[index]);
  });
  const logs = runRaceSimulator(raceTrack, raceTrackNode, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, raceTrackNode, logs);
  const outPath = path.resolve(__dirname, "../race-result.html");
  testRaceWebGL(outPath, htmlString);
  const monitor = new RaceMonitor();
  await monitor.saveInitialRaceState(raceTrack, horses);
}

async function runReSimulateMode() {
  const monitor = new RaceMonitor();
  const { track: raceTrack, horses } = await monitor.loadInitialRaceState();
  const raceTrackNode = new RaceTrackNode(raceTrack);
  // todo: debug delete
  await saveTrackPNG(raceTrackNode);
  const gateNodes = raceTrackNode.getGateNodes();
  const raceHorses: RaceHorse[] = [horses[0]].map((horse, index) => {
    return new RaceHorse(horse, gateNodes[index]);
  });
  const logs = runRaceSimulator(raceTrack, raceTrackNode, raceHorses);
  const htmlString = generateRaceWebGLHtml(raceTrack, raceTrackNode, logs);
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
