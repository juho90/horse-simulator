import { Horse, HorseRaceState } from "./horse";
import { RacePhase, TrackOptions } from "./types";

type TurnLog = {
  turn: number;
  states: { name: string; gate: number; position: number }[];
};

export class RaceSimulator {
  private horses: Horse[];
  private track: TrackOptions;

  constructor(horses: Horse[], track: TrackOptions) {
    this.horses = horses;
    this.track = track;
  }

  private shuffle<T>(array: T[]): T[] {
    return array
      .map((value) => {
        return { value, sort: Math.random() };
      })
      .sort((a, b) => {
        return a.sort - b.sort;
      })
      .map(({ value }) => value);
  }

  private shouldSpurt(state: HorseRaceState, finishLine: number): boolean {
    const horse = state.horse;
    const staminaLeft = state.staminaLeft;
    const distLeft = finishLine - state.position;
    const optimalSpurtDist = 18 + (100 - (horse.stats.paceSense ?? 5) * 10);

    if (
      !state.isSpurting &&
      staminaLeft > (horse.stats.burst ?? 8) * 1.5 &&
      distLeft <= optimalSpurtDist
    ) {
      return true;
    }
    return false;
  }

  private tryOvertake(
    states: HorseRaceState[],
    corner: { start: number; end: number }
  ) {
    for (let i = states.length - 1; i >= 0; i--) {
      const curr = states[i];

      const inCorner =
        curr.position >= corner.start && curr.position < corner.end;

      if (inCorner) {
        const targetGate = curr.gate - 1;

        if (targetGate < 1) {
          continue;
        }

        const blocking = states.find((s) => {
          const sameGate = s.gate === targetGate;
          const closePosition = Math.abs(s.position - curr.position) < 1.0;
          return sameGate && closePosition;
        });

        if (!blocking) {
          const myPower =
            (curr.horse.stats.cornering ?? 7) +
            (curr.horse.stats.positioning ?? 7) +
            (curr.horse.stats.temperament ?? 6) +
            Math.random();

          const inner = states.find((s) => {
            const sameGate = s.gate === targetGate;
            const closePosition = Math.abs(s.position - curr.position) < 3.0;
            return sameGate && closePosition;
          });

          let innerPower = 0;
          if (inner) {
            innerPower =
              (inner.horse.stats.cornering ?? 7) +
              (inner.horse.stats.positioning ?? 7) +
              (inner.horse.stats.temperament ?? 6) +
              Math.random();
          }

          if (!inner || myPower > innerPower) {
            curr.gate = targetGate;
          }
        }
      }
    }
  }

  public run(): TurnLog[] {
    let states: HorseRaceState[] = this.shuffle(this.horses).map(
      (horse, idx) => {
        return horse.createRaceState(idx + 1);
      }
    );

    let winner: Horse | null = null;
    let turn = 0;
    const logs: TurnLog[] = [];

    const finishLine = this.track.finishLine;

    while (!winner) {
      turn++;

      if (this.track.corners) {
        for (let c = 0; c < this.track.corners.length; c++) {
          const corner = this.track.corners[c];
          this.tryOvertake(states, corner);
        }
      }

      for (let sIdx = 0; sIdx < states.length; sIdx++) {
        const s = states[sIdx];
        const horse = s.horse;

        const progress = s.position / finishLine;
        let phase: RacePhase;
        if (progress < 0.3) {
          phase = RacePhase.Early;
        } else if (progress < 0.7) {
          phase = RacePhase.Middle;
        } else {
          phase = RacePhase.Final;
        }

        if (this.shouldSpurt(s, finishLine)) {
          s.isSpurting = true;
        }

        let inCorner = false;
        if (this.track.corners) {
          for (let c = 0; c < this.track.corners.length; c++) {
            const corner = this.track.corners[c];
            if (s.position >= corner.start && s.position < corner.end) {
              const cornering = horse.stats.cornering ?? 7;
              const gatePenalty = 1 - (s.gate - 1) * 0.005;
              const cornerBonus = cornering * 0.01;
              s.run(phase);
              s.applyCornerPenalty(cornering, gatePenalty, cornerBonus);
              inCorner = true;
              break;
            }
          }
        }

        if (!inCorner) {
          s.run(phase);
        }
      }

      for (let sIdx = 0; sIdx < states.length; sIdx++) {
        const s = states[sIdx];
        if (s.position >= finishLine && !winner) {
          winner = s.horse;
        }
      }

      const turnStates = [];
      for (let sIdx = 0; sIdx < states.length; sIdx++) {
        const s = states[sIdx];
        turnStates.push({
          name: s.horse.name,
          gate: s.gate,
          position: s.position,
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
