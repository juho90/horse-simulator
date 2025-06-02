type RenderState = {
  turn: number;
  states: { name: string; gate: number; position: number }[];
};

export class RaceRenderer {
  static renderTrack(log: RenderState, trackLength: number): void {
    const gateCount = Math.max(...log.states.map((s) => s.gate));
    const lines: string[] = [];
    for (let gateNum = 1; gateNum <= gateCount; gateNum++) {
      const horsesOnGate = log.states.filter((s) => s.gate === gateNum);
      let line = `${gateNum.toString().padStart(2, "0")}|`;
      for (let pos = 0; pos <= trackLength; pos += 2) {
        const horseHere = horsesOnGate.find(
          (s) => Math.abs(s.position - pos) < 1
        );
        if (horseHere) {
          line += horseHere.name[0];
        } else {
          line += "-";
        }
      }
      lines.push(line);
    }
    console.log(`\n[Turn ${log.turn}]`);
    console.log(lines.join("\n"));
  }

  static renderRace(logs: RenderState[], trackLength: number): void {
    logs.forEach((log) => this.renderTrack(log, trackLength));
  }
}
