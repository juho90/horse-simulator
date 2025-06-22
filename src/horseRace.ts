import { RaceTrack } from "./raceTrack";

export interface Horse {
  id: number;
  name: string;
  speed: number; // m/턴
  distance: number; // 누적 이동 거리
}

export interface HorseHistory {
  id: number;
  name: string;
  speed: number;
  distance: number;
}

export interface HorseTurnState {
  turn: number;
  horses: HorseHistory[];
}

export class HorseRace {
  horses: Horse[];
  track: RaceTrack;
  turn: number;
  finished: boolean;
  winner: Horse | null;
  history: HorseTurnState[];

  constructor(horses: Horse[], track: RaceTrack) {
    this.horses = horses;
    this.track = track;
    this.turn = 0;
    this.finished = false;
    this.winner = null;
    this.history = [];
  }

  nextTurn() {
    if (this.finished) return;
    this.turn++;
    for (const horse of this.horses) {
      horse.distance += horse.speed;
      if (!this.finished && horse.distance >= this.track.raceLength) {
        this.finished = true;
        this.winner = horse;
      }
    }
    const horses: HorseHistory[] = [];
    for (const horse of this.horses) {
      horses.push({
        id: horse.id,
        name: horse.name,
        speed: horse.speed,
        distance: horse.distance,
      });
    }
    // 턴별 상태 저장
    this.history.push({
      turn: this.turn,
      horses: horses,
    });
  }

  getHistory(): HorseTurnState[] {
    return this.history;
  }
}

export function createHorses(): Horse[] {
  const horses: Horse[] = [];
  for (let i = 1; i <= 10; i++) {
    // 평균 60m/턴, 약간의 랜덤성 부여
    const speed = 55 + Math.floor(Math.random() * 11); // 55~65
    horses.push({ id: i, name: `Horse${i}`, speed, distance: 0 });
  }
  return horses;
}
