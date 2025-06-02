import { Horse } from "./horse";
import { TrackOptions } from "./types";

function shuffle<T>(array: T[]): T[] {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

export function simulateRace(
  horses: Horse[],
  track: TrackOptions = { finishLine: 100 }
): Horse {
  const shuffled = shuffle(horses);
  const gateAssignments = shuffled.map((horse, idx) => ({
    horse,
    gate: idx + 1,
  }));

  console.log("게이트 배치:");
  gateAssignments.forEach(({ horse, gate }) => {
    console.log(`${gate}번 게이트: ${horse.name}`);
  });

  let winner: Horse | null = null;
  let turn = 0;

  while (!winner) {
    turn++;
    gateAssignments.forEach(({ horse, gate }) => {
      // 여러 코너 지원
      let inCorner = false;
      if (track.corners) {
        for (const corner of track.corners) {
          if (horse.position >= corner.start && horse.position < corner.end) {
            // 바깥쪽 게이트일수록 속도 감소
            const cornerPenalty = 1 - (gate - 1) * 0.005;
            horse.run(turn);
            horse.position *= cornerPenalty;
            inCorner = true;
            break;
          }
        }
      }
      if (!inCorner) {
        horse.run(turn);
      }
    });

    gateAssignments.forEach(({ horse }) => {
      if (horse.position >= track.finishLine && !winner) {
        winner = horse;
      }
    });

    // 현재 상황 출력
    console.log(
      gateAssignments
        .map(
          ({ horse, gate }) =>
            `${gate}번(${horse.name}): ${horse.position.toFixed(1)}m`
        )
        .join(" | ")
    );
  }

  console.log(`🏆 Winner: ${(winner as Horse).name}!`);
  return winner;
}
