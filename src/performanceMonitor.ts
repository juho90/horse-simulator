import { DrivingMode } from "./drivingMode";
import { AIDecision } from "./raceAI";
import { RaceHorse } from "./raceHorse";

interface PerformanceMetrics {
  horseId: string;
  averageSpeed: number;
  maxSpeed: number;
  staminaEfficiency: number;
  modeTransitions: number;
  collisionAvoidances: number;
  overtakeAttempts: number;
  overtakeSuccesses: number;
  positionChanges: number;
  lastSpurtDuration: number;
  totalDecisions: number;
}

interface ModeStatistics {
  mode: DrivingMode;
  duration: number;
  avgSpeed: number;
  staminaUsed: number;
  successRate: number;
}

export class PerformanceMonitor {
  private horses: Map<string, RaceHorse>;
  private decisionHistory: Map<string, AIDecision[]>;
  private modeHistory: Map<
    string,
    {
      mode: DrivingMode;
      timestamp: number;
      position: { x: number; y: number };
    }[]
  >;
  private performanceMetrics: Map<string, PerformanceMetrics>;
  private startTime: number;

  constructor() {
    this.horses = new Map();
    this.decisionHistory = new Map();
    this.modeHistory = new Map();
    this.performanceMetrics = new Map();
    this.startTime = Date.now();
  }

  addHorse(horse: RaceHorse): void {
    this.horses.set(horse.horseId.toString(), horse);
    this.decisionHistory.set(horse.horseId.toString(), []);
    this.modeHistory.set(horse.horseId.toString(), []);
    this.performanceMetrics.set(horse.horseId.toString(), {
      horseId: horse.horseId.toString(),
      averageSpeed: 0,
      maxSpeed: 0,
      staminaEfficiency: 0,
      modeTransitions: 0,
      collisionAvoidances: 0,
      overtakeAttempts: 0,
      overtakeSuccesses: 0,
      positionChanges: 0,
      lastSpurtDuration: 0,
      totalDecisions: 0,
    });
  }

  recordDecision(horseId: string, decision: AIDecision): void {
    const history = this.decisionHistory.get(horseId);
    if (history) {
      history.push(decision);
      this.updateMetrics(horseId, decision);
    }
  }

  recordModeChange(
    horseId: string,
    mode: DrivingMode,
    position: { x: number; y: number }
  ): void {
    const history = this.modeHistory.get(horseId);
    if (history) {
      history.push({
        mode,
        timestamp: Date.now(),
        position,
      });
    }
  }

  getPerformanceMetrics(horseId: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(horseId);
  }

  getAllPerformanceMetrics(): PerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }

  getModeStatistics(horseId: string): ModeStatistics[] {
    const history = this.modeHistory.get(horseId);
    const decisions = this.decisionHistory.get(horseId);
    if (!history || !decisions) {
      return [];
    }
    const modeStats = new Map<
      DrivingMode,
      {
        totalDuration: number;
        totalSpeed: number;
        totalStamina: number;
        count: number;
        successes: number;
      }
    >();
    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const next = history[i + 1];
      const duration = next
        ? next.timestamp - current.timestamp
        : Date.now() - current.timestamp;
      if (!modeStats.has(current.mode)) {
        modeStats.set(current.mode, {
          totalDuration: 0,
          totalSpeed: 0,
          totalStamina: 0,
          count: 0,
          successes: 0,
        });
      }
      const stats = modeStats.get(current.mode)!;
      stats.totalDuration += duration;
      stats.count++;
      const relatedDecisions = decisions.filter(
        (d) => d.currentMode === current.mode
      );
      if (relatedDecisions.length > 0) {
        const avgSpeed =
          relatedDecisions.reduce((sum, d) => sum + d.targetSpeed, 0) /
          relatedDecisions.length;
        stats.totalSpeed += avgSpeed;
      }
    }
    return Array.from(modeStats.entries()).map(([mode, stats]) => ({
      mode,
      duration: stats.totalDuration,
      avgSpeed: stats.totalSpeed / Math.max(stats.count, 1),
      staminaUsed: stats.totalStamina / Math.max(stats.count, 1),
      successRate: stats.successes / Math.max(stats.count, 1),
    }));
  }

  private updateMetrics(horseId: string, decision: AIDecision): void {
    const metrics = this.performanceMetrics.get(horseId);
    const horse = this.horses.get(horseId);
    if (!metrics || !horse) {
      return;
    }
    metrics.totalDecisions++;
    if (horse.speed > metrics.maxSpeed) {
      metrics.maxSpeed = horse.speed;
    }
    const decisions = this.decisionHistory.get(horseId) || [];
    if (decisions.length > 0) {
      const totalSpeed = decisions.reduce((sum, d) => sum + d.targetSpeed, 0);
      metrics.averageSpeed = totalSpeed / decisions.length;
    }
    if (
      decision.urgencyLevel === "emergency" ||
      decision.urgencyLevel === "high"
    ) {
      metrics.collisionAvoidances++;
    }
    if (decision.currentMode === DrivingMode.Overtaking) {
      metrics.overtakeAttempts++;
    }
    if (decision.currentMode === DrivingMode.LastSpurt) {
      metrics.lastSpurtDuration++;
    }
    const modeHistory = this.modeHistory.get(horseId) || [];
    if (modeHistory.length > 1) {
      const lastMode = modeHistory[modeHistory.length - 2];
      if (lastMode.mode !== decision.currentMode) {
        metrics.modeTransitions++;
      }
    }
    const staminaRatio = horse.stamina / horse.maxStamina;
    const speedRatio = horse.speed / horse.maxSpeed;
    metrics.staminaEfficiency = (speedRatio + staminaRatio) / 2;
  }

  generateReport() {
    const allMetrics = this.getAllPerformanceMetrics();
    const analysis = this.getPerformanceAnalysis();

    let report = "=== AI Performance Report ===\n\n";

    report += `Race Duration: ${((Date.now() - this.startTime) / 1000).toFixed(
      1
    )} seconds\n`;
    report += `Total Horses: ${allMetrics.length}\n\n`;

    if (analysis.bestPerformer) {
      const bestHorse = this.horses.get(analysis.bestPerformer.horseId);
      report += `Best Performer: ${
        bestHorse?.name || analysis.bestPerformer.horseId
      }\n`;
      report += `  Stamina Efficiency: ${(
        analysis.bestPerformer.staminaEfficiency * 100
      ).toFixed(1)}%\n`;
      report += `  Average Speed: ${analysis.bestPerformer.averageSpeed.toFixed(
        1
      )}\n\n`;
    }

    report += "=== Individual Horse Performance ===\n";
    for (const metrics of allMetrics) {
      const horse = this.horses.get(metrics.horseId);
      if (!horse) {
        continue;
      }
      report += `Horse: ${horse.name} (ID: ${metrics.horseId})\n`;
      report += `  Average Speed: ${metrics.averageSpeed.toFixed(1)}\n`;
      report += `  Max Speed: ${metrics.maxSpeed.toFixed(1)}\n`;
      report += `  Stamina Efficiency: ${(
        metrics.staminaEfficiency * 100
      ).toFixed(1)}%\n`;
      report += `  Mode Transitions: ${metrics.modeTransitions}\n`;
      report += `  Collision Avoidances: ${metrics.collisionAvoidances}\n`;
      report += `  Overtake Attempts: ${metrics.overtakeAttempts}\n`;
      report += `  Overtake Successes: ${metrics.overtakeSuccesses}\n`;
      report += `  Total Decisions: ${metrics.totalDecisions}\n`;
      report += "---\n";
    }

    report += "\n=== Performance Analysis ===\n";
    report += `Average Stamina Efficiency: ${(
      analysis.averageMetrics.staminaEfficiency * 100
    ).toFixed(1)}%\n`;
    report += `Average Speed: ${analysis.averageMetrics.averageSpeed.toFixed(
      1
    )}\n`;
    report += `Total Collision Avoidances: ${allMetrics.reduce(
      (sum, m) => sum + m.collisionAvoidances,
      0
    )}\n`;
    report += `Total Overtake Attempts: ${allMetrics.reduce(
      (sum, m) => sum + m.overtakeAttempts,
      0
    )}\n`;

    if (analysis.recommendations.length > 0) {
      report += "\n=== Recommendations ===\n";
      analysis.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }
    console.log(report);
  }

  reset(): void {
    this.decisionHistory.clear();
    this.modeHistory.clear();
    this.performanceMetrics.clear();
    this.startTime = Date.now();
    console.log("Performance monitor reset");
  }

  async generateFinalReport(raceId?: string): Promise<void> {
    const report = this.generateReport();
    const analysis = this.getPerformanceAnalysis();

    console.log(report);

    if (raceId) {
      await this.savePerformanceData(raceId);
      await this.saveCSVReport(`performance_${raceId}.csv`);
    }

    console.log("\n=== Final Performance Summary ===");
    if (analysis.bestPerformer) {
      const bestHorse = this.horses.get(analysis.bestPerformer.horseId);
      console.log(
        `🏆 Winner: ${bestHorse?.name || analysis.bestPerformer.horseId}`
      );
      console.log(
        `   Efficiency: ${(
          analysis.bestPerformer.staminaEfficiency * 100
        ).toFixed(1)}%`
      );
    }

    console.log(`📊 Race Statistics:`);
    console.log(
      `   Total Horses: ${
        analysis.averageMetrics ? this.getAllPerformanceMetrics().length : 0
      }`
    );
    console.log(
      `   Average Efficiency: ${
        analysis.averageMetrics
          ? (analysis.averageMetrics.staminaEfficiency * 100).toFixed(1)
          : 0
      }%`
    );
    console.log(
      `   Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`
    );

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 AI Improvement Suggestions:`);
      analysis.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
  }

  async savePerformanceData(
    raceId: string = `race_${Date.now()}`
  ): Promise<void> {
    const performanceData = {
      raceId,
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
      horses: this.getAllPerformanceMetrics(),
      modeStatistics: Object.fromEntries(
        Array.from(this.horses.keys()).map((horseId) => [
          horseId,
          this.getModeStatistics(horseId),
        ])
      ),
      summary: this.generateSummaryStats(),
    };

    const filePath = `./performance-${raceId}.json`;

    try {
      const fs = await import("fs/promises");
      await fs.writeFile(filePath, JSON.stringify(performanceData, null, 2));
      console.log(`Performance data saved: ${filePath}`);
    } catch (error) {
      console.error("Failed to save performance data:", error);
    }
  }

  private generateSummaryStats(): {
    totalHorses: number;
    averageSpeed: number;
    averageStaminaEfficiency: number;
    totalCollisionAvoidances: number;
    totalOvertakeAttempts: number;
    totalModeTransitions: number;
    raceDurationMs: number;
  } {
    const allMetrics = this.getAllPerformanceMetrics();

    return {
      totalHorses: allMetrics.length,
      averageSpeed:
        allMetrics.reduce((sum, m) => sum + m.averageSpeed, 0) /
        allMetrics.length,
      averageStaminaEfficiency:
        allMetrics.reduce((sum, m) => sum + m.staminaEfficiency, 0) /
        allMetrics.length,
      totalCollisionAvoidances: allMetrics.reduce(
        (sum, m) => sum + m.collisionAvoidances,
        0
      ),
      totalOvertakeAttempts: allMetrics.reduce(
        (sum, m) => sum + m.overtakeAttempts,
        0
      ),
      totalModeTransitions: allMetrics.reduce(
        (sum, m) => sum + m.modeTransitions,
        0
      ),
      raceDurationMs: Date.now() - this.startTime,
    };
  }

  displayRealTimeStats(): void {
    const summary = this.generateSummaryStats();
    console.clear();
    console.log("=== Real-Time Performance Monitor ===");
    console.log(
      `Race Duration: ${(summary.raceDurationMs / 1000).toFixed(1)}s`
    );
    console.log(`Total Horses: ${summary.totalHorses}`);
    console.log(`Avg Speed: ${summary.averageSpeed.toFixed(1)}`);
    console.log(
      `Avg Stamina Efficiency: ${(
        summary.averageStaminaEfficiency * 100
      ).toFixed(1)}%`
    );
    console.log(
      `Total Collision Avoidances: ${summary.totalCollisionAvoidances}`
    );
    console.log(`Total Overtake Attempts: ${summary.totalOvertakeAttempts}`);
    console.log(`Total Mode Transitions: ${summary.totalModeTransitions}`);
    console.log("=====================================");

    const topPerformers = this.getAllPerformanceMetrics()
      .sort((a, b) => b.staminaEfficiency - a.staminaEfficiency)
      .slice(0, 3);

    console.log("Top 3 Performers:");
    topPerformers.forEach((metrics, index) => {
      const horse = this.horses.get(metrics.horseId);
      console.log(
        `${index + 1}. ${horse?.name || metrics.horseId} - Efficiency: ${(
          metrics.staminaEfficiency * 100
        ).toFixed(1)}%`
      );
    });
  }

  exportToCSV(): string {
    const allMetrics = this.getAllPerformanceMetrics();
    let csv =
      "horseId,horseName,averageSpeed,maxSpeed,staminaEfficiency,modeTransitions,collisionAvoidances,overtakeAttempts,overtakeSuccesses,totalDecisions\n";

    allMetrics.forEach((metrics) => {
      const horse = this.horses.get(metrics.horseId);
      csv += `${metrics.horseId},${horse?.name || "Unknown"},${
        metrics.averageSpeed
      },${metrics.maxSpeed},${metrics.staminaEfficiency},${
        metrics.modeTransitions
      },${metrics.collisionAvoidances},${metrics.overtakeAttempts},${
        metrics.overtakeSuccesses
      },${metrics.totalDecisions}\n`;
    });

    return csv;
  }

  async saveCSVReport(
    filename: string = `performance_${Date.now()}.csv`
  ): Promise<void> {
    const csvData = this.exportToCSV();

    try {
      const fs = await import("fs/promises");
      await fs.writeFile(filename, csvData);
      console.log(`CSV report saved: ${filename}`);
    } catch (error) {
      console.error("Failed to save CSV report:", error);
    }
  }

  getPerformanceAnalysis(): {
    bestPerformer: PerformanceMetrics | null;
    worstPerformer: PerformanceMetrics | null;
    averageMetrics: PerformanceMetrics;
    recommendations: string[];
  } {
    const allMetrics = this.getAllPerformanceMetrics();

    if (allMetrics.length === 0) {
      return {
        bestPerformer: null,
        worstPerformer: null,
        averageMetrics: {} as PerformanceMetrics,
        recommendations: ["No performance data available"],
      };
    }

    const bestPerformer = allMetrics.reduce((best, current) =>
      current.staminaEfficiency > best.staminaEfficiency ? current : best
    );

    const worstPerformer = allMetrics.reduce((worst, current) =>
      current.staminaEfficiency < worst.staminaEfficiency ? current : worst
    );

    const averageMetrics: PerformanceMetrics = {
      horseId: "average",
      averageSpeed:
        allMetrics.reduce((sum, m) => sum + m.averageSpeed, 0) /
        allMetrics.length,
      maxSpeed:
        allMetrics.reduce((sum, m) => sum + m.maxSpeed, 0) / allMetrics.length,
      staminaEfficiency:
        allMetrics.reduce((sum, m) => sum + m.staminaEfficiency, 0) /
        allMetrics.length,
      modeTransitions: Math.round(
        allMetrics.reduce((sum, m) => sum + m.modeTransitions, 0) /
          allMetrics.length
      ),
      collisionAvoidances: Math.round(
        allMetrics.reduce((sum, m) => sum + m.collisionAvoidances, 0) /
          allMetrics.length
      ),
      overtakeAttempts: Math.round(
        allMetrics.reduce((sum, m) => sum + m.overtakeAttempts, 0) /
          allMetrics.length
      ),
      overtakeSuccesses: Math.round(
        allMetrics.reduce((sum, m) => sum + m.overtakeSuccesses, 0) /
          allMetrics.length
      ),
      positionChanges: Math.round(
        allMetrics.reduce((sum, m) => sum + m.positionChanges, 0) /
          allMetrics.length
      ),
      lastSpurtDuration: Math.round(
        allMetrics.reduce((sum, m) => sum + m.lastSpurtDuration, 0) /
          allMetrics.length
      ),
      totalDecisions: Math.round(
        allMetrics.reduce((sum, m) => sum + m.totalDecisions, 0) /
          allMetrics.length
      ),
    };

    const recommendations: string[] = [];

    if (averageMetrics.staminaEfficiency < 0.6) {
      recommendations.push("전체적인 스태미나 효율성 개선 필요");
    }

    if (
      averageMetrics.collisionAvoidances >
      averageMetrics.totalDecisions * 0.3
    ) {
      recommendations.push("충돌 회피 빈도가 높음 - 경로 계획 개선 필요");
    }

    if (
      averageMetrics.overtakeAttempts > 0 &&
      averageMetrics.overtakeSuccesses === 0
    ) {
      recommendations.push("추월 성공률이 낮음 - 추월 전략 재검토 필요");
    }

    if (averageMetrics.modeTransitions > averageMetrics.totalDecisions * 0.5) {
      recommendations.push("모드 전환이 빈번함 - 안정성 개선 필요");
    }

    return {
      bestPerformer,
      worstPerformer,
      averageMetrics,
      recommendations,
    };
  }
}
