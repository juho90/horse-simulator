// Race.ts
// 경주 진행 및 결과 관리
import { Horse } from "./Horse";

export class Race {
  horses: Horse[];
  distance: number;
  finished: boolean;
  winner: Horse | null;
  tracks: number;

  constructor(horses: Horse[], distance: number = 100) {
    this.horses = horses;
    this.distance = distance;
    this.finished = false;
    this.winner = null;
    this.tracks = horses.length; // 트랙 수 = 말 수
  }

  // 해당 트랙, 위치에 말이 있는지 확인
  isBlocked(track: number, position: number, exceptHorse?: Horse): boolean {
    return this.horses.some(
      (h) =>
        h !== exceptHorse &&
        h.track === track &&
        Math.abs(h.position - position) < 0.01
    );
  }

  step() {
    // 말들을 현재 위치 기준으로 정렬 (선두부터)
    this.horses.sort((a, b) => b.position - a.position);
    for (let i = 0; i < this.horses.length; i++) {
      const horse = this.horses[i];
      // 앞에 있는 말의 위치(같은 트랙에서만)
      let maxPositionAhead = this.distance;
      const frontHorse = this.horses.find(
        (h) => h.track === horse.track && h.position > horse.position
      );
      if (frontHorse) {
        maxPositionAhead = frontHorse.position;
        if (maxPositionAhead - horse.position < 0.01) {
          maxPositionAhead = horse.position; // 더 이상 못 감
        }
      }
      // 만약 앞이 막혀서 이동 불가하면, 옆 트랙으로 이동 시도
      if (maxPositionAhead === horse.position) {
        let moved = false;
        for (const dir of [-1, 1]) {
          // 왼쪽, 오른쪽 순서로 시도
          const newTrack = horse.track + dir;
          if (
            newTrack >= 1 &&
            newTrack <= this.tracks &&
            !this.isBlocked(newTrack, horse.position, horse)
          ) {
            horse.track = newTrack;
            moved = true;
            break;
          }
        }
        // 옆 트랙으로 이동했으면 다시 앞 확인
        if (moved) {
          const frontHorse2 = this.horses.find(
            (h) => h.track === horse.track && h.position > horse.position
          );
          maxPositionAhead = frontHorse2 ? frontHorse2.position : this.distance;
        }
      }
      horse.move(maxPositionAhead);
      if (horse.position >= this.distance && !this.finished) {
        this.finished = true;
        this.winner = horse;
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }
}
