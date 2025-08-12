import * as fs from "fs";
import { convertHorsesForRace, Horse } from "./horse";
import { convertTrackForRace, RaceTrack } from "./raceTrack";

export class RaceMonitor {
  async saveSituationReport(report: string): Promise<void> {
    const filename = "race-statistics.txt";
    try {
      await fs.promises.writeFile(filename, report, "utf-8");
      console.log(`🎯 상황 분석 리포트가 ${filename}에 저장되었습니다.`);
    } catch (error) {
      console.error("리포트 저장 실패:", error);
    }
  }

  async saveInitialRaceState(
    track: RaceTrack,
    horses: Horse[],
    filename = "race-initial-state.json"
  ): Promise<void> {
    const initialState = {
      track,
      horses,
    };
    await fs.promises.writeFile(
      filename,
      JSON.stringify(initialState, null, 2),
      "utf-8"
    );
  }

  async loadInitialRaceState(
    filename = "race-initial-state.json"
  ): Promise<{ track: RaceTrack; horses: Horse[] }> {
    const data = await fs.promises.readFile(filename, "utf-8");
    const initialState = JSON.parse(data);
    const track = convertTrackForRace(initialState.track);
    const horses = convertHorsesForRace(initialState.horses);
    return {
      track,
      horses,
    };
  }
}
