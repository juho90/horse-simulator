import { RACE_VALUES } from "./raceValues";

export class RaceRenderer {
  /**
   * 1등 기준 200m 이내 말만, 10m당 한 칸(=1000 단위)으로 위치를 시각화하여 로그로 출력
   */
  static renderRace(logs: any[], finishLine: number) {
    for (const log of logs) {
      // 1등 위치 계산
      const maxDist = Math.max(...log.states.map((s: any) => s.distance));
      const filtered = log.states.filter(
        (s: any) => maxDist - s.distance <= 200 * RACE_VALUES.UNIT
      );
      const minDist = Math.max(0, maxDist - 200 * RACE_VALUES.UNIT);
      const slotSize = 10 * RACE_VALUES.UNIT;
      const slotCount = Math.ceil((200 * RACE_VALUES.UNIT) / slotSize);

      // 말 위치 시각화
      console.log(`\n[Turn ${log.turn}]`);
      for (const state of filtered) {
        const relDist = state.distance - minDist;
        const slot = Math.floor(relDist / slotSize);
        let line = "";
        for (let i = 0; i < slotCount; i++) {
          line += i === slot ? state.name[0] : "-";
        }
        const distMeter = (state.distance / RACE_VALUES.UNIT).toFixed(2);
        console.log(
          `${state.name.padEnd(10)} | Lane: ${
            state.lane
          } | ${line} | ${distMeter}m`
        );
      }
      // 구간 눈금
      let scale = "          |";
      for (let i = 0; i <= slotCount; i += 10) {
        scale +=
          (minDist / RACE_VALUES.UNIT + i * 10).toFixed(0).padStart(4) + "m";
      }
      console.log(scale);
    }
    // 결승선도 m 단위로 출력
    console.log(`\n🏁 결승선: ${(finishLine / RACE_VALUES.UNIT).toFixed(2)}m`);
  }
}
