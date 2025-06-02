import * as fs from "fs";
import * as path from "path";
import { Horse } from "./horse";
import { simulateRace } from "./simulateRace";

// horses.json 읽기
const horsesJsonPath = path.join(__dirname, "..", "data", "horses.json");
const horsesData = JSON.parse(fs.readFileSync(horsesJsonPath, "utf-8"));
const horses = horsesData.map((h: any) => new Horse(h.name, h.stats));

// tracks.json 읽기
const tracksJsonPath = path.join(__dirname, "..", "data", "tracks.json");
const tracksData = JSON.parse(fs.readFileSync(tracksJsonPath, "utf-8"));

// 원하는 경기장 선택
const track = tracksData[0];
console.log(`\n🏟️ 경기장: ${track.name}`);

simulateRace(horses, track);
