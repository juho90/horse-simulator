import { RACE_VALUES } from "./raceValues";

export class RaceRenderer {
  static renderRace(logs: any[], finishLine: number) {
    for (const log of logs) {
      console.log(`\n[Turn ${log.turn}]`);
      for (const state of log.states) {
        const posMeter = (state.position / RACE_VALUES.UNIT).toFixed(2);
        console.log(
          `  ${state.name.padEnd(10)} | Gate: ${
            state.gate
          } | Position: ${posMeter}m`
        );
      }
    }
    console.log(`\n🏁 결승선: ${(finishLine / 100).toFixed(2)}m`);
  }
}
