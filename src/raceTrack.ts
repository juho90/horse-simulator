import { TrackOptions } from "./interfaces";
import { RaceHorse } from "./raceHorse";
import { RacePhase } from "./raceValues";

export class RaceTrack {
  public name: string;
  public finishLine: number;
  constructor(track: TrackOptions) {
    this.name = track.name;
    this.finishLine = track.finishLine;
  }

  public getRacePhase(progress: number): RacePhase {
    if (progress < 0.3) {
      return RacePhase.Early;
    }
    if (progress < 0.7) {
      return RacePhase.Middle;
    }
    return RacePhase.Final;
  }

  public getPhaseByHorse(horse: RaceHorse): RacePhase {
    const progress = horse.distance / this.finishLine;
    return this.getRacePhase(progress);
  }

  public getLastSpurtAccel(horse: RaceHorse, phase: RacePhase): number {
    const isFinalPhase = phase === RacePhase.Final;
    const hasStamina = horse.staminaLeft > 0;
    if (isFinalPhase && hasStamina) {
      return 0.2;
    } else {
      return 0;
    }
  }

  public isIgnoreStaminaPenaltyPhase(phase: RacePhase): boolean {
    return phase === RacePhase.Final;
  }

  public getPhaseEffectInfo(horse: RaceHorse): {
    phase: RacePhase;
    lastSpurtAccel: number;
    ignoreStaminaPenalty: boolean;
  } {
    const phase = this.getPhaseByHorse(horse);
    const lastSpurtAccel = this.getLastSpurtAccel(horse, phase);
    const ignoreStaminaPenalty = this.isIgnoreStaminaPenaltyPhase(phase);
    return {
      phase: phase,
      lastSpurtAccel: lastSpurtAccel,
      ignoreStaminaPenalty: ignoreStaminaPenalty,
    };
  }
}
