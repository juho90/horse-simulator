// main.ts
// 시뮬레이터 실행 및 사용자 인터페이스
import { Horse } from "./Horse";
import { Race } from "./Race";

function main() {
  const horses = [
    new Horse("썬더", 10, 1),
    new Horse("블리츠", 9, 2),
    new Horse("스톰", 11, 3),
  ];
  const race = new Race(horses, 100);

  console.log("경마 시뮬레이터 시작!");
  while (!race.isFinished()) {
    race.step();
    horses.forEach((horse) => {
      console.log(
        `${horse.name} (트랙 ${horse.track}): ${horse.position.toFixed(1)}m`
      );
    });
    console.log("---");
  }
  if (race.winner) {
    console.log(`우승마: ${race.winner.name}!`);
  }
}

main();
