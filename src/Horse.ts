// Horse.ts
// 말의 속성 및 동작 정의
export class Horse {
  name: string;
  speed: number; // 1턴당 이동 거리
  position: number;
  track: number; // 트랙 번호(라인)

  constructor(name: string, speed: number, track: number) {
    this.name = name;
    this.speed = speed;
    this.position = 0;
    this.track = track;
  }

  move(maxPositionAhead: number) {
    const moveDist = this.speed * (0.8 + Math.random() * 0.4);
    let nextPos = this.position + moveDist;
    if (nextPos > maxPositionAhead) {
      nextPos = maxPositionAhead;
    }
    this.position = nextPos;
  }
}
