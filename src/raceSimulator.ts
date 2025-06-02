import { Horse } from "./horse";
import { TrackOptions } from "./interfaces";
import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceTrack } from "./raceTrack";
import { RACE_VALUES } from "./raceValues";

type TurnLog = {
  turn: number;
  states: { name: string; lane: number; distance: number }[];
};

/**
 * RaceSimulator
 * - 말 경주 시뮬레이션의 메인 클래스
 * - 말 상태 초기화, 매 턴 진행, 코너 추월, 스퍼트 판정 등 전체 레이스 흐름을 담당
 */
export class RaceSimulator {
  private horses: RaceHorse[];
  private track: RaceTrack;
  private raceCorners: RaceCorner[];
  private raceFinished = false;

  constructor(horses: Horse[], trackOptions: TrackOptions) {
    const shuffledHorses = this.shuffle(horses);
    this.horses = shuffledHorses.map(
      (horse, idx) => new RaceHorse(horse, idx + 1)
    );
    this.track = new RaceTrack(trackOptions);
    this.raceCorners = (trackOptions.corners ?? []).map(
      (c) => new RaceCorner(c)
    );
  }

  // --- 유틸리티/헬퍼 함수 ---

  private randomVariance(): number {
    return Math.random() - RACE_VALUES.RANDOM_BASE;
  }

  private shuffle<T>(array: T[]): T[] {
    const mapped = array.map((value) => {
      return { value, sort: Math.random() };
    });
    mapped.sort((a, b) => {
      return a.sort - b.sort;
    });
    const result: T[] = [];
    for (let i = 0; i < mapped.length; i++) {
      result.push(mapped[i].value);
    }
    return result;
  }

  // --- 메인 레이스 로직 ---

  private tryOvertake(horses: RaceHorse[], corner: RaceCorner) {
    for (let i = horses.length - 1; i >= 0; i--) {
      const curr = horses[i];
      // 1. 코너 구간 여부
      const inCorner = corner.isInCorner(curr.distance);
      if (!inCorner) {
        continue;
      }
      // 2. 추월 시도 레인
      const targetLane = curr.lane - 1;
      if (targetLane < 1) {
        continue;
      }
      // 3. 블로킹 여부
      const blocked = curr.isLaneBlocked(horses, targetLane);
      if (blocked) {
        continue;
      }
      // 4. 추월 시도마다 스태미나 감소
      curr.staminaLeft -= 0.2;
      // 5. 내 파워/내측마 파워 계산 (코너 난이도 수치 반드시 전달)
      const myPower = curr.getCornerOvertakePower(corner.difficulty);
      const inner = curr.getInnerHorseInLane(horses, targetLane);
      let innerPower = 0;
      if (inner) {
        innerPower = inner.getCornerOvertakePower(corner.difficulty);
      }
      // 6. 추월 성공 판정
      if (!inner || myPower > innerPower) {
        curr.lane = targetLane;
      }
    }
  }

  private tryPositioningFight(horses: RaceHorse[], curr: RaceHorse) {
    // 이미 1레인(인코스)이면 시도 안 함
    if (curr.lane === 1) {
      return;
    }
    // 인코스(내측)로 진입 가능한지 체크
    const targetLane = curr.lane - 1;
    const blocked = curr.isLaneBlocked(horses, targetLane);
    if (!blocked) {
      // 포지셔닝 능력치 + 랜덤성으로 진입 성공 판정
      const myScore = curr.positioning + this.randomVariance();
      // 내측마(인코스)와 비교
      const inner = curr.getInnerHorseInLane(horses, targetLane);
      let innerScore = 0;
      if (inner) {
        innerScore = inner.positioning + this.randomVariance();
      }
      // 포지션 싸움 시도마다 스태미나 소모
      curr.staminaLeft -= RACE_VALUES.POSITION_FIGHT_STAMINA;
      if (!inner || myScore > innerScore) {
        curr.lane = targetLane;
      }
    }
  }

  /**
   * 레이스 전체 시뮬레이션 실행
   * - 매 턴마다 말 상태 갱신, 코너 추월, 스퍼트, 로그 기록
   * - 1회만 실행 가능, 이미 끝난 레이스는 재호출 불가
   */
  public run(): TurnLog[] {
    if (this.raceFinished) {
      throw new Error(
        "이 RaceSimulator 인스턴스에서는 run()을 한 번만 호출할 수 있습니다."
      );
    }
    this.raceFinished = true;

    let winner: string | null = null;
    let turn = 0;
    const logs: TurnLog[] = [];
    const finishLine = this.track.finishLine;

    while (!winner) {
      turn++;

      // 각 코너마다 추월 시도
      for (let c = 0; c < this.raceCorners.length; c++) {
        const corner = this.raceCorners[c];
        this.tryOvertake(this.horses, corner);
      }

      // --- 직선 구간에서 포지션 싸움(코너 진입 전) ---
      for (let c = 0; c < this.raceCorners.length; c++) {
        const corner = this.raceCorners[c];
        const fightStart =
          corner.start - RACE_VALUES.POSITION_FIGHT_RANGE * RACE_VALUES.UNIT;
        const fightEnd = corner.start;
        for (let hIdx = 0; hIdx < this.horses.length; hIdx++) {
          const horse = this.horses[hIdx];
          if (horse.distance >= fightStart && horse.distance < fightEnd) {
            this.tryPositioningFight(this.horses, horse);
          }
        }
      }

      // 각 말의 상태 갱신 (달리기, 코너 패널티, 스퍼트 등)
      for (let hIdx = 0; hIdx < this.horses.length; hIdx++) {
        const horse = this.horses[hIdx];
        horse.updateRaceState(this.track, this.horses);
      }

      // 결승선 통과자 체크
      for (let hIdx = 0; hIdx < this.horses.length; hIdx++) {
        const horse = this.horses[hIdx];
        if (horse.distance >= finishLine && !winner) {
          winner = horse.name;
        }
      }

      // 턴별 상태 기록
      const turnStates = [];
      for (let hIdx = 0; hIdx < this.horses.length; hIdx++) {
        const horse = this.horses[hIdx];
        turnStates.push({
          name: horse.name,
          lane: horse.lane,
          distance: horse.distance,
        });
      }

      logs.push({
        turn,
        states: turnStates,
      });
    }

    return logs;
  }
}
