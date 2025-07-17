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

export class AIPerformanceMonitor {
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

  generateReport(): string {
    const allMetrics = this.getAllPerformanceMetrics();
    let report = "=== AI Performance Report ===\n\n";
    for (const metrics of allMetrics) {
      const horse = this.horses.get(metrics.horseId);
      if (!horse) {
        continue;
      }
      report += `Horse: ${horse.name} (ID: ${metrics.horseId})\n`;
      report += `Average Speed: ${metrics.averageSpeed.toFixed(1)}\n`;
      report += `Max Speed: ${metrics.maxSpeed.toFixed(1)}\n`;
      report += `Stamina Efficiency: ${(
        metrics.staminaEfficiency * 100
      ).toFixed(1)}%\n`;
      report += `Mode Transitions: ${metrics.modeTransitions}\n`;
      report += `Collision Avoidances: ${metrics.collisionAvoidances}\n`;
      report += `Overtake Attempts: ${metrics.overtakeAttempts}\n`;
      report += `Total Decisions: ${metrics.totalDecisions}\n`;
      report += "---\n";
    }
    return report;
  }

  reset(): void {
    this.decisionHistory.clear();
    this.modeHistory.clear();
    this.performanceMetrics.clear();
    this.startTime = Date.now();
  }
}
