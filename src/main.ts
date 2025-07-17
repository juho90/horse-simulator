import * as path from "path";
import { createSampleHorses } from "./horse";
import { displayRaceResults, displayTrackInfo } from "./raceLog";
import { runRaceSimulator } from "./raceSimulator";
import { createTrack } from "./raceTrack";
import { generateRaceWebGLHtml, testRaceWebGL } from "./raceViewerWebGL";

function main() {
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
