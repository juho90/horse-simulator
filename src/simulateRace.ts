import { Horse } from "./horse";
import { TrackOptions } from "./types";

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

  public run(): Horse {
    const shuffled = this.shuffle(this.horses);
    const gateAssignments = shuffled.map((horse, idx) => ({
      horse,
      gate: idx + 1,
    }));

    console.log("게이트 배치:");
    gateAssignments.forEach(({ horse, gate }) => {
      console.log(`${gate}번 게이트: ${horse.name}`);
    });

    let winner: Horse | null = null;
    let turn = 0;

    while (!winner) {
      turn++;
      gateAssignments.forEach(({ horse, gate }) => {
        let inCorner = false;
        if (this.track.corners) {
          for (const corner of this.track.corners) {
            if (horse.position >= corner.start && horse.position < corner.end) {
              const cornerPenalty = 1 - (gate - 1) * 0.005;
              horse.run(turn);
              horse.position *= cornerPenalty;
              inCorner = true;
              break;
            }
          }
        }
        if (!inCorner) {
          horse.run(turn);
        }
      });

      gateAssignments.forEach(({ horse }) => {
        if (horse.position >= this.track.finishLine && !winner) {
          winner = horse;
        }
      });

      console.log(
        gateAssignments
          .map(
            ({ horse, gate }) =>
              `${gate}번(${horse.name}): ${horse.position.toFixed(1)}m`
          )
          .join(" | ")
      );
    }

    console.log(`🏆 Winner: ${(winner as Horse).name}!`);
    return winner;
  }
}
