class Horse {
  constructor(
    public name: string,
    public speed: number,
    public position: number = 0
  ) {}

  run() {
    // 속도만큼 위치 증가 (랜덤 요소 추가 가능)
    this.position += this.speed * (0.8 + Math.random() * 0.4);
  }
}

const horses = [
  new Horse("Thunder", 10),
  new Horse("Lightning", 9),
  new Horse("Storm", 11),
];

const finishLine = 100;
let winner: Horse | null = null;

while (!winner) {
  horses.forEach((horse) => horse.run());
  horses.forEach((horse) => {
    if (horse.position >= finishLine && !winner) {
      winner = horse;
    }
  });

  // 현재 상황 출력
  console.log(
    horses.map((h) => `${h.name}: ${h.position.toFixed(1)}m`).join(" | ")
  );
}

console.log(`🏆 Winner: ${(winner as Horse).name}!`);
