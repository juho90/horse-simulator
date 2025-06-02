import { RaceHorse } from "./raceHorse";

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
    return new RaceHorse(this, gate);
  }
}
