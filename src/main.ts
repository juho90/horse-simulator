// main.ts (Node.js에서 실행, 경주 로그 생성)
import * as fs from "fs";
import { Horse } from "./Horse";
import { Race } from "./Race";
import { getRaceViewerHtml } from "./raceViewer";

interface HorseLog {
  name: string;
  position: number;
  track: number;
}

type RaceLog = HorseLog[];

function main() {
  const horses = [
    new Horse("썬더", 10, 1),
    new Horse("블리츠", 9, 2),
    new Horse("스톰", 11, 3),
  ];
  const race = new Race(horses, 100);
  const logs: RaceLog[] = [];

  // 첫 턴(시작 상태) 저장
  logs.push(
    horses.map((h) => ({
      name: h.name,
      position: h.position,
      track: h.track,
    }))
  );

  while (!race.isFinished()) {
    race.step();
    logs.push(
      horses.map((h) => ({
        name: h.name,
        position: h.position,
        track: h.track,
      }))
    );
  }

  // logs를 포함한 단순 HTML 생성 및 저장
  const html = getRaceViewerHtml(logs);
  fs.writeFileSync("src/index.html", html, "utf-8");
  console.log("경주 로그가 포함된 index.html이 생성되었습니다.");

  // Windows에서 기본 브라우저로 index.html 자동 열기
  const { exec } = require("child_process");
  exec(`start "" "src/index.html"`);
}

main();
