import * as fs from "fs";
import * as path from "path";

type HorseStats = {
  speed: number;
  stamina: number;
  burst: number;
  temperament: number;
  weight: number;
};

class Horse {
  public position: number = 0;
  public staminaLeft: number;

  constructor(public name: string, public stats: HorseStats) {
    this.staminaLeft = stats.stamina;
  }

  run(turn: number) {
    let effectiveSpeed = this.stats.speed;

    if (this.staminaLeft < this.stats.stamina * 0.5) {
      effectiveSpeed *= 0.9;
    }
    if (turn < 5) {
      effectiveSpeed += this.stats.burst * 0.3;
    }
    const temperamentEffect =
      (Math.random() - 0.5) * this.stats.temperament * 0.1;
    effectiveSpeed += temperamentEffect;
    effectiveSpeed -= this.stats.weight * 0.05;

    this.position += effectiveSpeed * (0.8 + Math.random() * 0.4);
    this.staminaLeft -= 1;
  }
}

type Corner = { start: number; end: number };
type TrackOptions = {
  finishLine: number;
  corners?: Corner[];
};

function shuffle<T>(array: T[]): T[] {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function simulateRace(
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
