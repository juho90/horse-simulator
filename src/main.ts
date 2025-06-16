import { exec } from "child_process";
import * as fs from "fs";
import { createHorses, HorseRace } from "./horseRace";
import { createTrack } from "./raceTrack";
import { generateRaceHtml } from "./raceViewer";

function main() {
  // 트랙 정보(길이, 코너) 설정
  const track = createTrack();
  const horses = createHorses();
  const race = new HorseRace(horses, track);

  // 경주 진행
  while (!race.finished) {
    race.nextTurn();
  }

  // 결과 출력
  console.log(`경주 종료! 총 턴: ${race.turn}`);
  if (race.winner) {
    console.log(`우승마: ${race.winner.name} (속도: ${race.winner.speed}m/턴)`);
  }
  console.log("턴별 경주마 상태:");
  for (const turnState of race.getHistory()) {
    const horseStates = turnState.horses
      .map((h) => `${h.name}: ${h.distance}m`)
      .join(", ");
    console.log(`턴 ${turnState.turn}: ${horseStates}`);
  }

  // HTML 생성 및 실행
  const html = generateRaceHtml(race.getHistory(), track);
  const outPath = "race-result.html";
  fs.writeFileSync(outPath, html, "utf-8");
  exec(`start ${outPath}`);
}

main();
