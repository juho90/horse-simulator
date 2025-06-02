import { Horse } from "./horse";
import { RACE_CONST } from "./raceConfig";
import { RaceHorse } from "./raceHorse";
import { RacePhase, TrackOptions } from "./types";

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
  private horses: Horse[];
  private track: TrackOptions;

  constructor(horses: Horse[], track: TrackOptions) {
    this.horses = horses;
    this.track = track;
  }

  /** 배열을 무작위로 섞음 (스타트 게이트 랜덤 배정) */
  private shuffle<T>(array: T[]): T[] {
    // 배열을 무작위로 섞음 (스타트 게이트 랜덤 배정)
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

  /** 코너에서 추월 시도 로직 */
  private tryOvertake(
    horses: RaceHorse[],
    corner: { start: number; end: number }
  ) {
    for (let i = horses.length - 1; i >= 0; i--) {
      const curr = horses[i];
      // 1. 코너 구간 여부
      const inCorner = RaceHorse.isInCorner(curr.distance, corner);
      if (!inCorner) {
        continue;
      }
      // 2. 추월 시도 레인
      const targetLane = curr.lane - 1;
      if (targetLane < 1) {
        continue;
      }
      // 3. 블로킹 여부
      const blocked = this.isBlocked(horses, curr, targetLane);
      if (blocked) {
        continue;
      }
      // 4. 추월 시도마다 스태미나 감소
      curr.staminaLeft -= 0.2;
      // 5. 내 파워/내측마 파워 계산
      const myPower = curr.calcCornerOvertakePower();
      const inner = this.findInnerHorse(horses, curr, targetLane);
      let innerPower = 0;
      if (inner) {
        innerPower = inner.calcCornerOvertakePower();
      }
      // 6. 추월 성공 판정
      if (!inner || myPower > innerPower) {
        curr.lane = targetLane;
      }
    }
  }

  /** 추월 시 같은 레인, 가까운 위치에 말이 있으면 블로킹 */
  private isBlocked(
    horses: RaceHorse[],
    curr: RaceHorse,
    targetLane: number
  ): boolean {
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      const sameLane = h.lane === targetLane;
      const diff = Math.abs(h.distance - curr.distance);
      const blocked = sameLane && diff < RACE_CONST.CLOSE_POSITION_BLOCK;
      if (blocked) {
        return true;
      }
    }
    return false;
  }

  /** 내측마(인코스) 찾기 */
  private findInnerHorse(
    horses: RaceHorse[],
    curr: RaceHorse,
    targetLane: number
  ): RaceHorse | undefined {
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      const sameLane = h.lane === targetLane;
      const diff = Math.abs(h.distance - curr.distance);
      const isInner = sameLane && diff < RACE_CONST.CLOSE_POSITION_INNER;
      if (isInner) {
        return h;
      }
    }
    return undefined;
  }

  /**
   * 같은 레인에서 앞에 있는 말 중 가장 가까운 말 찾기
   */
  private findSameLaneAhead(
    horses: RaceHorse[],
    self: RaceHorse
  ): RaceHorse | undefined {
    let closestAhead: RaceHorse | undefined = undefined;
    for (let i = 0; i < horses.length; i++) {
      const other = horses[i];
      const sameLane = other.lane === self.lane;
      const ahead = other.distance > self.distance;
      if (sameLane && ahead) {
        if (!closestAhead || other.distance < closestAhead.distance) {
          closestAhead = other;
        }
      }
    }
    return closestAhead;
  }

  /**
   * 슬립스트림 보너스 계산 (앞말과 10~30m 이내면 속도/가속 보너스)
   */
  private calcSlipstreamBonus(
    horses: RaceHorse[],
    self: RaceHorse
  ): { speed: number; accel: number } {
    // 1. 같은 레인에서 앞에 있는 말 찾기
    const sameLaneAhead = this.findSameLaneAhead(horses, self);
    if (!sameLaneAhead) {
      return { speed: 0, accel: 0 };
    }
    // 2. 앞말과의 거리 계산
    const distanceToAhead = sameLaneAhead.distance - self.distance;
    const inSlipstreamZone =
      distanceToAhead >= RACE_CONST.SLIPSTREAM_MIN_DIST &&
      distanceToAhead <= RACE_CONST.SLIPSTREAM_MAX_DIST;
    // 3. 보너스 적용
    let slipstreamBonus = 0;
    let accelBonus = 0;
    if (inSlipstreamZone) {
      slipstreamBonus = RACE_CONST.SLIPSTREAM_SPEED_BONUS;
      accelBonus = RACE_CONST.SLIPSTREAM_ACCEL_BONUS;
    }
    return { speed: slipstreamBonus, accel: accelBonus };
  }

  /**
   * 라스트 스퍼트 가속 보너스 계산 (Final phase에서 남은 체력 있을 때)
   */
  private calcLastSpurtAccelBonus(phase: RacePhase, horse: RaceHorse): number {
    const isFinalPhase = phase === RacePhase.Final;
    const hasStamina = horse.staminaLeft > 0;
    let bonus = 0;
    if (isFinalPhase && hasStamina) {
      bonus = 0.2;
    }
    return bonus;
  }

  /**
   * 라스트 스퍼트(phase === Final)에서 스태미나 패널티 무시 여부
   */
  private shouldIgnoreStaminaPenalty(phase: RacePhase): boolean {
    if (phase === RacePhase.Final) {
      return true;
    }
    return false;
  }

  /**
   * 현재 진행률로 구간(phase) 결정
   */
  private getRacePhase(progress: number): RacePhase {
    if (progress < 0.3) {
      return RacePhase.Early;
    }
    if (progress < 0.7) {
      return RacePhase.Middle;
    }
    return RacePhase.Final;
  }

  /**
   * 턴별 말 상태 갱신 및 보너스 적용
   */
  private updateHorseState(
    horses: RaceHorse[],
    horse: RaceHorse,
    finishLine: number
  ) {
    // 현재 진행률 계산
    const progress = horse.distance / finishLine;
    // 구간(phase) 결정
    const phase = this.getRacePhase(progress);
    // 슬립스트림 보너스 계산
    const slipstream = this.calcSlipstreamBonus(horses, horse);
    // 라스트 스퍼트 가속 보너스 계산
    const lastSpurtAccelBonus = this.calcLastSpurtAccelBonus(phase, horse);
    // 라스트 스퍼트 시 스태미나 패널티 무시 여부
    const ignoreStaminaPenalty = this.shouldIgnoreStaminaPenalty(phase);
    // 상태 필드에 보너스/패널티 적용
    horse.ignoreStaminaPenalty = ignoreStaminaPenalty;
    horse.slipstreamSpeedBonus = slipstream.speed;
    horse.slipstreamAccelBonus = slipstream.accel;
    horse.lastSpurtAccelBonus = lastSpurtAccelBonus;
    // 말의 한 턴 실행
    horse.run(phase);
  }

  /**
   * 레이스 전체 시뮬레이션 실행
   * - 매 턴마다 말 상태 갱신, 코너 추월, 스퍼트, 로그 기록
   */
  public run(): TurnLog[] {
    // 말 상태 초기화 및 레인 배정
    let horses: RaceHorse[] = this.shuffle(this.horses).map((horse, idx) => {
      return new RaceHorse(horse, idx + 1);
    });

    let winner: string | null = null;
    let turn = 0;
    const logs: TurnLog[] = [];
    const finishLine = this.track.finishLine;

    while (!winner) {
      turn++;

      // 각 코너마다 추월 시도
      if (this.track.corners) {
        for (let c = 0; c < this.track.corners.length; c++) {
          const corner = this.track.corners[c];
          this.tryOvertake(horses, corner);
        }
      }

      // 각 말의 상태 갱신 (달리기, 코너 패널티, 스퍼트 등)
      for (let hIdx = 0; hIdx < horses.length; hIdx++) {
        this.updateHorseState(horses, horses[hIdx], finishLine);
      }

      // 결승선 통과자 체크
      for (let hIdx = 0; hIdx < horses.length; hIdx++) {
        const horse = horses[hIdx];
        if (horse.distance >= finishLine && !winner) {
          winner = horse.name;
        }
      }

      // 턴별 상태 기록
      const turnStates = [];
      for (let hIdx = 0; hIdx < horses.length; hIdx++) {
        const horse = horses[hIdx];
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
