import * as fs from "fs";

export class RaceLogAnalyzer {
  private log: any[];
  private horseNames: string[];
  constructor(log: any[]) {
    if (!Array.isArray(log) || log.length === 0) {
      throw new Error("로그 데이터가 없습니다.");
    }
    this.log = log;
    this.horseNames = log[0].states.map((s: any) => s.name) as string[];
  }

  getTotalTurns(): number {
    return this.log.length;
  }

  getFinishDistances() {
    return this.horseNames.map((name) => {
      const last = this.log[this.log.length - 1].states.find(
        (s: any) => s.name === name
      );
      return { name, distance: last ? last.distance : 0 };
    });
  }

  getHorseStats() {
    const finishDistances = this.getFinishDistances();
    return this.horseNames.map((name) => {
      let maxSpeed = 0;
      let sumSpeed = 0;
      let minStamina = Infinity;
      let count = 0;
      for (const turn of this.log) {
        const s = turn.states.find((x: any) => x.name === name);
        if (s) {
          if (s.speed > maxSpeed) maxSpeed = s.speed;
          if (s.staminaLeft < minStamina) minStamina = s.staminaLeft;
          sumSpeed += s.speed;
          count++;
        }
      }
      const avgSpeed = count > 0 ? sumSpeed / count : 0;
      return {
        name,
        maxSpeed,
        avgSpeed,
        minStamina,
        finishDistance:
          finishDistances.find((f) => f.name === name)?.distance ?? 0,
      };
    });
  }

  getRankSummary() {
    const rankStats: Record<
      string,
      { first: number; totalRank: number; count: number }
    > = {};
    this.horseNames.forEach(
      (name) => (rankStats[name] = { first: 0, totalRank: 0, count: 0 })
    );
    for (const turn of this.log) {
      const sorted = [...turn.states].sort(
        (a: any, b: any) => b.distance - a.distance
      );
      for (let i = 0; i < sorted.length; i++) {
        const name = sorted[i].name;
        rankStats[name].totalRank += i + 1;
        rankStats[name].count++;
        if (i === 0) rankStats[name].first++;
      }
    }
    return this.horseNames.map((name) => ({
      name,
      first: rankStats[name].first,
      avgRank:
        rankStats[name].count > 0
          ? rankStats[name].totalRank / rankStats[name].count
          : 0,
    }));
  }

  getSummaryObject() {
    return {
      totalTurns: this.getTotalTurns(),
      stats: this.getHorseStats(),
      rankSummary: this.getRankSummary(),
    };
  }

  saveStatsJson(path = "race_stats.json") {
    const fs = require("fs");
    fs.writeFileSync(
      path,
      JSON.stringify(this.getSummaryObject(), null, 2),
      "utf-8"
    );
  }

  /**
   * HorseOptions[]과 트랙 가중치를 받아 디버그 JSON 저장 (불필요 정보 제거)
   */
  saveHorseDebugJson(
    horses: any[],
    trackStatWeights: Record<string, number>,
    path = "horse_debug.json"
  ) {
    const fs = require("fs");
    fs.writeFileSync(
      path,
      JSON.stringify(
        horses.map((h: any) => ({
          name: h.profile.name,
          runningStyle: h.profile.runningStyle,
          weight: h.profile.weight,
          temperament: h.profile.temperament,
          stats: h.stats,
          trackStatWeights: trackStatWeights,
          styleStatWeights:
            (h.profile.runningStyle &&
              require("./raceFactory").RaceFactory.RUNNING_STYLE_WEIGHTS[
                h.profile.runningStyle
              ]) ||
            undefined,
        })),
        null,
        2
      ),
      "utf-8"
    );
  }

  saveRaceLogs(logs: any[], path = "race_log.json") {
    const fs = require("fs");
    fs.writeFileSync(path, JSON.stringify(logs, null, 2), "utf-8");
  }

  printSummaryToConsole() {
    const summary = this.getSummaryObject();
    console.log(`[레이스 통계] 턴 수: ${summary.totalTurns}`);
    for (const stat of summary.stats) {
      console.log(
        `${stat.name} - 최고속도: ${stat.maxSpeed.toFixed(
          2
        )}, 평균속도: ${stat.avgSpeed.toFixed(
          2
        )}, 최소스태미나: ${stat.minStamina.toFixed(
          2
        )}, 결승선: ${stat.finishDistance.toFixed(1)}`
      );
    }
    for (const r of summary.rankSummary) {
      console.log(
        `${r.name}: 1등 ${r.first}회, 평균순위 ${r.avgRank.toFixed(2)}`
      );
    }
  }

  getHorseProfilesAndStats(horseList: any[]): any[] {
    // horseList: RaceManager에서 전달받은 Horse[]
    return horseList.map((h: any) => ({
      name: h.profile?.name ?? h.name,
      runningStyle: h.profile?.runningStyle,
      weight: h.profile?.weight,
      temperament: h.profile?.temperament,
      ...h.stats,
    }));
  }

  printProfileStatSummary(horseList: any[]) {
    const arr = this.getHorseProfilesAndStats(horseList);
    console.log("[말 프로필+스탯 요약]");
    arr.forEach((h) => {
      console.log(
        `${h.name} | ${h.runningStyle} | 체중:${h.weight} | 기질:${h.temperament} | speed:${h.speed} | stamina:${h.stamina} | power:${h.power} | paceSense:${h.paceSense} | cornering:${h.cornering} | positioning:${h.positioning}`
      );
    });
  }

  printProfileStatOutliers(horseList: any[]) {
    // 각질별 평균 스탯과의 차이가 큰 말(이상치) 탐지
    const arr = this.getHorseProfilesAndStats(horseList);
    const styles = Array.from(new Set(arr.map((h) => h.runningStyle)));
    const statKeys = [
      "speed",
      "stamina",
      "power",
      "paceSense",
      "cornering",
      "positioning",
    ];
    const styleMeans: Record<string, Record<string, number>> = {};
    styles.forEach((style) => {
      const styleHorses = arr.filter((h) => h.runningStyle === style);
      statKeys.forEach((k) => {
        styleMeans[style] = styleMeans[style] || {};
        styleMeans[style][k] =
          styleHorses.reduce((sum, h) => sum + (h[k] ?? 0), 0) /
          styleHorses.length;
      });
    });
    console.log("[각질별 스탯 이상치 탐지]");
    arr.forEach((h) => {
      const means = styleMeans[h.runningStyle];
      const outlierStats = statKeys.filter(
        (k) => Math.abs(h[k] - means[k]) > 100 // 임계값(100) 이상 차이
      );
      if (outlierStats.length > 0) {
        console.log(
          `⭐️ ${h.name} (${h.runningStyle}) 이상치: ${outlierStats
            .map((k) => `${k}:${h[k]}(평균:${means[k].toFixed(1)})`)
            .join(", ")}`
        );
      }
    });
  }

  printSummaryToConsoleWithProfiles(horseList: any[]) {
    this.printProfileStatSummary(horseList);
    this.printProfileStatOutliers(horseList);
    this.printSummaryToConsole();
  }

  /**
   * 트랙 정보(이름, 스탯 가중치) 로그 출력
   */
  static logTrackInfo(track: {
    name: string;
    statWeights: Record<string, number>;
  }) {
    console.log(`\n🏟️ 경기장: ${track.name}`);
    console.table(track.statWeights);
  }
}

// CLI로 직접 실행 시: race_log.json 읽어서 파일로 저장
if (require.main === module) {
  const log = JSON.parse(fs.readFileSync("race_log.json", "utf-8"));
  const analyzer = new RaceLogAnalyzer(log);
  analyzer.saveStatsJson();
  analyzer.printSummaryToConsole();
}
