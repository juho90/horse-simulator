import { Horse } from "./horse";
import { TrackOptions } from "./types";

type HorseState = {
  horse: Horse;
  gate: number;
};

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
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }

  private tryOvertake(
    states: HorseState[],
    corner: { start: number; end: number }
  ) {
    for (let i = states.length - 1; i >= 0; i--) {
      const curr = states[i];
      if (
        curr.horse.position >= corner.start &&
        curr.horse.position < corner.end
      ) {
        const targetGate = curr.gate - 1;
        if (targetGate < 1) continue;
        const blocking = states.find(
          (s) =>
            s.gate === targetGate &&
            Math.abs(s.horse.position - curr.horse.position) < 1.0
        );
        if (!blocking) {
          const power =
            curr.horse.stats.burst +
            curr.horse.stats.temperament +
            Math.random();
          const inner = states.find(
            (s) =>
              s.gate === targetGate &&
              Math.abs(s.horse.position - curr.horse.position) < 3.0
          );
          const innerPower = inner
            ? inner.horse.stats.burst +
              inner.horse.stats.temperament +
              Math.random()
            : 0;
          if (!inner || power > innerPower) {
            curr.gate = targetGate;
          }
        }
      }
    }
  }

  // run()이 로그 배열을 반환하도록 변경
  public run(): TurnLog[] {
    let states: HorseState[] = this.shuffle(this.horses).map((horse, idx) => ({
      horse,
      gate: idx + 1,
    }));

    let winner: Horse | null = null;
    let turn = 0;
    const logs: TurnLog[] = [];

    while (!winner) {
      turn++;
      if (this.track.corners) {
        for (const corner of this.track.corners) {
          this.tryOvertake(states, corner);
        }
      }

      states.forEach((s) => {
        let inCorner = false;
        if (this.track.corners) {
          for (const corner of this.track.corners) {
            if (
              s.horse.position >= corner.start &&
              s.horse.position < corner.end
            ) {
              const cornerPenalty = 1 - (s.gate - 1) * 0.005;
              s.horse.run(turn);
              s.horse.position *= cornerPenalty;
              inCorner = true;
              break;
            }
          }
        }
        if (!inCorner) {
          s.horse.run(turn);
        }
      });

      states.forEach((s) => {
        if (s.horse.position >= this.track.finishLine && !winner) {
          winner = s.horse;
        }
      });

      // 로그 저장
      logs.push({
        turn,
        states: states.map((s) => ({
          name: s.horse.name,
          gate: s.gate,
          position: s.horse.position,
        })),
      });
    }

    return logs;
  }
}
