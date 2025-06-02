import { RacePhase } from "./types";

export type HorseStats = {
  speed: number; // 기본 속도
  stamina: number; // 지구력(힘 비축/분배)
  burst: number; // 순간 가속력(스퍼트)
  paceSense: number; // 페이스 감각(스퍼트 타이밍)
  cornering: number; // 코너 적성(코너에서의 안정성)
  positioning: number; // 위치 선정(인코스 진입 등)
  temperament: number; // 기질(변동성, 추월 적극성)
  weight: number; // 체중(무거울수록 불리)
};

export class Horse {
  public name: string;
  public stats: HorseStats;

  constructor(name: string, stats: HorseStats) {
    this.name = name;
    this.stats = stats;
  }

  // 경기 중 상태를 생성
  createRaceState(gate: number) {
    return new HorseRaceState(this, gate);
  }
}

// 경기 중 상태
export class HorseRaceState {
  public horse: Horse;
  public gate: number;
  public position: number = 0;
  public staminaLeft: number;
  public isSpurting: boolean = false;

  constructor(horse: Horse, gate: number) {
    this.horse = horse;
    this.gate = gate;
    this.staminaLeft = horse.stats.stamina ?? 12;
  }

  run(phase: RacePhase) {
    let effectiveSpeed = this.horse.stats.speed ?? 10;

    if (phase === RacePhase.Early) {
      effectiveSpeed *= 0.92;
      this.staminaLeft -= 0.7;
    } else if (phase === RacePhase.Middle) {
      effectiveSpeed *= 1.0;
      this.staminaLeft -= 1.0;
    } else {
      if (this.isSpurting && this.staminaLeft > 0) {
        // 스퍼트 효과를 점진적으로
        effectiveSpeed += (this.horse.stats.burst ?? 8) * 0.3;
        this.staminaLeft -= 1.5;
      } else {
        this.staminaLeft -= 1.2;
      }
    }

    if (this.staminaLeft < (this.horse.stats.stamina ?? 12) * 0.5) {
      effectiveSpeed *= 0.9;
    }

    // 체중 패널티
    effectiveSpeed -= (this.horse.stats.weight ?? 5) * 0.05;

    // 기질(temperament) 변동성
    effectiveSpeed +=
      (Math.random() - 0.5) * (this.horse.stats.temperament ?? 6) * 0.05;

    // 이동량 계수 축소
    const moveFactor = 0.95 + Math.random() * 0.05;

    // 최대 이동량 제한 (예: 1턴에 7m)
    let move = effectiveSpeed * moveFactor;
    if (move > 7) {
      move = 7;
    }
    if (move < 0) {
      move = 0;
    }

    this.position += move;
  }

  // 코너 패널티 적용
  applyCornerPenalty(
    cornering: number,
    gatePenalty: number,
    cornerBonus: number
  ) {
    this.position *= gatePenalty + cornerBonus;
  }
}
