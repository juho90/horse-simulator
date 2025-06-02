type HorseStats = {
  speed: number; // 기본 속도
  stamina: number; // 지구력 (경주 후반에 영향)
  burst: number; // 순간 가속력 (초반/중반에 영향)
  temperament: number; // 기질 (변동성, 예측 불가성)
  weight: number; // 체중 (가벼울수록 유리)
};

class Horse {
  public position: number = 0;
  public staminaLeft: number;

  constructor(public name: string, public stats: HorseStats) {
    this.staminaLeft = stats.stamina;
  }

  run(turn: number) {
    // 기본 속도
    let effectiveSpeed = this.stats.speed;

    // stamina가 줄면 속도 감소
    if (this.staminaLeft < this.stats.stamina * 0.5) {
      effectiveSpeed *= 0.9;
    }

    // burst: 초반 20% 구간에서 추가 가속
    if (turn < 5) {
      effectiveSpeed += this.stats.burst * 0.3;
    }

    // temperament: 변동성 반영
    const temperamentEffect =
      (Math.random() - 0.5) * this.stats.temperament * 0.1;
    effectiveSpeed += temperamentEffect;

    // weight: 무거우면 속도 감소
    effectiveSpeed -= this.stats.weight * 0.05;

    // 실제 이동
    this.position += effectiveSpeed * (0.8 + Math.random() * 0.4);

    // stamina 소모
    this.staminaLeft -= 1;
  }
}

const horses = [
  new Horse("Thunder", {
    speed: 10,
    stamina: 12,
    burst: 8,
    temperament: 5,
    weight: 5,
  }),
  new Horse("Lightning", {
    speed: 9,
    stamina: 14,
    burst: 7,
    temperament: 6,
    weight: 4,
  }),
  new Horse("Storm", {
    speed: 11,
    stamina: 10,
    burst: 9,
    temperament: 4,
    weight: 6,
  }),
  new Horse("Blaze", {
    speed: 10,
    stamina: 11,
    burst: 10,
    temperament: 7,
    weight: 5,
  }),
  new Horse("Shadow", {
    speed: 8,
    stamina: 15,
    burst: 6,
    temperament: 3,
    weight: 4,
  }),
  new Horse("Comet", {
    speed: 12,
    stamina: 9,
    burst: 11,
    temperament: 8,
    weight: 7,
  }),
  new Horse("Rocket", {
    speed: 9,
    stamina: 13,
    burst: 8,
    temperament: 6,
    weight: 5,
  }),
  new Horse("Spirit", {
    speed: 10,
    stamina: 12,
    burst: 9,
    temperament: 5,
    weight: 5,
  }),
  new Horse("Phantom", {
    speed: 11,
    stamina: 10,
    burst: 10,
    temperament: 7,
    weight: 6,
  }),
  new Horse("Blizzard", {
    speed: 8,
    stamina: 14,
    burst: 7,
    temperament: 4,
    weight: 4,
  }),
];

// 1~10번 게이트에 말 무작위 배치
function shuffle<T>(array: T[]): T[] {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

const shuffledHorses = shuffle(horses);

console.log("게이트 배치:");
shuffledHorses.forEach((horse, idx) => {
  console.log(`${idx + 1}번 게이트: ${horse.name}`);
});

const finishLine = 100;
let winner: Horse | null = null;
let turn = 0;

while (!winner) {
  turn++;
  shuffledHorses.forEach((horse) => horse.run(turn));
  shuffledHorses.forEach((horse) => {
    if (horse.position >= finishLine && !winner) {
      winner = horse;
    }
  });

  // 현재 상황 출력
  console.log(
    shuffledHorses
      .map((h) => `${h.name}: ${h.position.toFixed(1)}m`)
      .join(" | ")
  );
}

if (!winner) {
  console.log("No winner found.");
} else {
  console.log(`🏆 Winner: ${(winner as Horse).name}!`);
}
