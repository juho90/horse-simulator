import * as fs from "fs";
import * as path from "path";
import { Horse } from "./horse";
import { TrackOptions } from "./interfaces";
import { RaceRenderer } from "./raceRenderer";
import { RaceSimulator } from "./raceSimulator";

// horses.json 읽기
const horsesJsonPath = path.join(__dirname, "..", "data", "horses.json");
const horsesData = JSON.parse(
  fs.readFileSync(horsesJsonPath, "utf-8")
) as Horse[];
const horses = horsesData.map((h: any) => new Horse(h.name, h.stats));

// tracks.json 읽기
const tracksJsonPath = path.join(__dirname, "..", "data", "tracks.json");
const tracksData = JSON.parse(
  fs.readFileSync(tracksJsonPath, "utf-8")
) as TrackOptions[];

// 트랙을 무작위로 선택
const track = tracksData[Math.floor(Math.random() * tracksData.length)];
console.log(`\n🏟️ 경기장: ${track.name}`);

const simulator = new RaceSimulator(horses, track);
const logs = simulator.run();
RaceRenderer.renderVisualizerHtml(logs, track);
