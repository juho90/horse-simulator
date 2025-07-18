import * as fs from "fs";
import * as path from "path";
import {
  DirectionalDistanceWithSource,
  DistanceSource,
} from "./directionalDistance";
import { Horse } from "./horse";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { TRACK_WIDTH } from "./raceSimulator";
import { RaceTrack } from "./raceTrack";

interface RaceData {
  raceId: string;
  timestamp: number;
  horses: RaceHorse[];
  logs: RaceLog[];
  performance: PerformanceMetrics[];
  events: RaceEvent[];
  duration: number;
}

interface PerformanceMetrics {
  horseId: string;
  horseName: string;
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
  finalPosition: number;
  raceDistance: number;
  finished: boolean;
  finishTime?: number;
  directionDistortions: number;
  avgDirectionDistortion: number;
  guardrailViolations: number;
  avgGuardrailDistance: number;
}

interface RaceEvent {
  turn: number;
  horseId: string;
  eventType:
    | "collision_avoidance"
    | "overtake_attempt"
    | "overtake_success"
    | "mode_change"
    | "finish"
    | "off_track"
    | "segment_progress"
    | "guardrail_violation"
    | "direction_distortion"
    | "threat_analysis"
    | "source_pattern";
  description: string;
  position: { x: number; y: number };
}

interface MonitorOptions {
  realTimeInterval?: number;
  saveReports?: boolean;
  enableWebStream?: boolean;
  verbose?: boolean;
}

interface ClosestThreatAnalysis {
  source: DistanceSource;
  direction: "front" | "left" | "right" | "frontLeft" | "frontRight";
  distance: number;
  severity: "low" | "medium" | "high" | "critical";
  recommendedAction: string;
}

interface DirectionalThreatAnalysis {
  closestThreat: ClosestThreatAnalysis;
  threats: {
    front: { source: DistanceSource; distance: number };
    left: { source: DistanceSource; distance: number };
    right: { source: DistanceSource; distance: number };
    frontLeft: { source: DistanceSource; distance: number };
    frontRight: { source: DistanceSource; distance: number };
  };
  safestDirection: "front" | "left" | "right" | "frontLeft" | "frontRight";
  recommendedStrategy: string;
}

export class PerformanceAnalysis {
  private raceHistory: RaceData[] = [];
  private currentRaceData: RaceData | null = null;
  private options: MonitorOptions;
  private startTime: number = 0;
  private finishTimes: Map<string, number> = new Map();

  constructor(options: MonitorOptions = {}) {
    this.options = {
      realTimeInterval: 10,
      saveReports: true,
      enableWebStream: false,
      verbose: true,
      ...options,
    };
  }

  async runRaceWithAnalysis(
    track: RaceTrack,
    horses: Horse[],
    raceId?: string
  ): Promise<RaceLog[]> {
    const finalRaceId = raceId || `race_${Date.now()}`;
    if (this.options.verbose) {
      console.log("🏇 Starting Performance Analysis...");
      console.log(
        `🏁 Track: ${track.segments?.length || 0} segments, ${
          track.raceLength
        }m`
      );
      console.log(`🐎 Horses: ${horses.length} competitors\n`);
    }
    this.initializeRace(horses, finalRaceId);
    const logs = this.runSimulationWithMonitoring(track, horses);
    this.analyzeRaceResults(logs);
    await this.generateInstantReport(finalRaceId);
    if (this.options.verbose) {
      console.log("✨ Race analysis completed!");
    }
    return logs;
  }

  private runSimulationWithMonitoring(
    track: RaceTrack,
    horses: Horse[]
  ): RaceLog[] {
    const raceHorses = horses.map(
      (horse, gate) => new RaceHorse(horse, track.segments || [], gate)
    );
    let turn = 0;
    const logs: RaceLog[] = [];
    const maxTurns = 3000;
    if (this.options.verbose) {
      console.log("🏁 Race starting with live AI monitoring...");
      console.log(
        `🎯 Target distance: ${track.raceLength}m, Max turns: ${maxTurns}`
      );
    }
    this.currentRaceData!.horses = raceHorses;

    while (raceHorses.some((h) => !h.finished) && turn < maxTurns) {
      this.monitorTurn(turn, raceHorses);
      const horseStates: HorseTurnState[] = [];
      try {
        for (let index = 0; index < raceHorses.length; index++) {
          const horse = raceHorses[index];
          if (!horse.finished) {
            this.trackHorsePerformance(horse, turn);
            const prevMode = horse.raceAI.getCurrentMode();
            horse.moveOnTrack(turn, raceHorses);
            const currentMode = horse.raceAI.getCurrentMode();
            if (track.isGoal(horse)) {
              horse.finished = true;
              this.finishTimes.set(horse.horseId.toString(), turn);
            }
            if (prevMode !== currentMode) {
              this.recordEvent(
                turn,
                horse.horseId.toString(),
                "mode_change",
                `Mode changed from ${prevMode} to ${currentMode}`,
                { x: horse.x, y: horse.y }
              );
            }
            this.detectEvents(horse, raceHorses, turn, track);
            if (horse.finished) {
              this.recordEvent(
                turn,
                horse.horseId.toString(),
                "finish",
                `Finished the race at turn ${turn}`,
                { x: horse.x, y: horse.y }
              );
              if (this.options.verbose) {
                console.log(`🏆 ${horse.name} finished at turn ${turn}!`);
              }
            }
          }
          horseStates[index] = this.captureHorseState(horse);
        }
      } catch (error) {
        console.error(`❌ Error at turn ${turn}:`, error);
        raceHorses.forEach((h) => (h.finished = true));
      }
      logs.push({ turn, horseStates });
      turn++;
    }
    this.currentRaceData!.logs = logs;
    this.currentRaceData!.duration = Date.now() - this.startTime;
    const finishedHorses = raceHorses.filter((h) => h.finished);
    const unfinishedHorses = raceHorses.filter((h) => !h.finished);

    if (this.options.verbose) {
      this.generateThreatAnalysisSummary(raceHorses);
    }

    if (this.options.verbose) {
      console.log(`\n🏁 Race completed after ${turn} turns:`);
      console.log(
        `   ✅ Finished horses: ${finishedHorses.length}/${raceHorses.length}`
      );
      if (unfinishedHorses.length > 0) {
        console.log(`   ⚠️  Unfinished horses progress:`);
        unfinishedHorses.forEach((horse) => {
          const progress = (
            (horse.raceDistance / track.raceLength) *
            100
          ).toFixed(1);
          console.log(
            `      ${horse.name}: ${horse.raceDistance.toFixed(
              0
            )}m (${progress}%)`
          );
        });
      }
      if (finishedHorses.length === 0) {
        console.log(
          `   🚨 CRITICAL: No horses finished! Consider increasing maxTurns or checking race logic`
        );
      }
    }
    return logs;
  }

  async generateComparativeReport(): Promise<void> {
    if (this.raceHistory.length === 0) {
      console.log("⚠️ No race data available for comparison");
      return;
    }
    console.log("🔬 Generating Multi-Race Comparative Analysis...");
    this.compareRacePerformances();
    this.identifyPatterns();
    this.generateImprovementSuggestions();
    if (this.options.saveReports) {
      await this.saveComparativeData();
    }
  }

  private initializeRace(horses: Horse[], raceId: string): void {
    this.startTime = Date.now();
    this.finishTimes.clear();
    this.currentRaceData = {
      raceId,
      timestamp: this.startTime,
      horses: [],
      logs: [],
      performance: [],
      events: [],
      duration: 0,
    };
  }

  private monitorTurn(turn: number, raceHorses: RaceHorse[]): void {
    for (const horse of raceHorses) {
      if (!horse.finished) {
        this.updatePerformanceMetrics(horse, turn);

        if (turn % 50 === 0 || this.isEmergencyDetected(horse)) {
          this.performRealTimeThreatAnalysis(horse, turn);
        }
      }
    }
  }

  private trackHorsePerformance(horse: RaceHorse, turn: number): void {
    const efficiency = horse.stamina > 0 ? horse.speed / horse.stamina : 0;
  }

  private detectEvents(
    horse: RaceHorse,
    allHorses: RaceHorse[],
    turn: number,
    track: RaceTrack
  ): void {
    const nearbyHorses = allHorses.filter(
      (h) =>
        h.horseId !== horse.horseId &&
        !h.finished &&
        Math.hypot(h.x - horse.x, h.y - horse.y) < 50
    );
    if (turn > 0) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "segment_progress",
        `Segment: ${horse.segmentIndex}, Distance: ${horse.raceDistance.toFixed(
          1
        )}m, Position: (${horse.x.toFixed(1)}, ${horse.y.toFixed(1)})`,
        { x: horse.x, y: horse.y }
      );
    }
    if (nearbyHorses.length > 0) {
      const minDistance = Math.min(
        ...nearbyHorses.map((h) => Math.hypot(h.x - horse.x, h.y - horse.y))
      );
      if (minDistance < 30) {
        this.recordEvent(
          turn,
          horse.horseId.toString(),
          "collision_avoidance",
          `Avoided collision with nearby horse (distance: ${minDistance.toFixed(
            1
          )}m)`,
          { x: horse.x, y: horse.y }
        );
      }
    }
    const overtakingHorses = nearbyHorses.filter(
      (h) => horse.raceDistance > h.raceDistance
    );
    if (overtakingHorses.length > 0) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "overtake_attempt",
        `Attempting to overtake ${overtakingHorses.length} horse(s)`,
        { x: horse.x, y: horse.y }
      );
    }
    this.detectGuardrailViolations(horse, track, turn);
    this.detectDirectionDistortion(horse, track, turn);
    this.detectThreatSources(horse, turn);
  }

  private detectGuardrailViolations(
    horse: RaceHorse,
    track: RaceTrack,
    turn: number
  ): void {
    if (!track.segments || track.segments.length === 0) {
      return;
    }
    const horsePosition = { x: horse.x, y: horse.y };
    const currentSegment =
      track.segments[horse.segmentIndex % track.segments.length];
    const trackWidth = TRACK_WIDTH;
    let violationDistance = 0;
    let violationType: "inner" | "outer" | null = null;
    try {
      if (currentSegment.type === "line") {
        const lineSegment = currentSegment as any;
        if (lineSegment.start && lineSegment.end) {
          const segmentStart = lineSegment.start;
          const segmentEnd = lineSegment.end;
          const dx = segmentEnd.x - segmentStart.x;
          const dy = segmentEnd.y - segmentStart.y;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          if (lineLength > 0) {
            const distToLine = Math.abs(
              (dy * horsePosition.x -
                dx * horsePosition.y +
                segmentEnd.x * segmentStart.y -
                segmentEnd.y * segmentStart.x) /
                lineLength
            );
            if (distToLine > trackWidth / 2) {
              violationDistance = distToLine - trackWidth / 2;
              violationType = "outer";
            }
          }
        }
      } else if (currentSegment.type === "corner") {
        const cornerSegment = currentSegment as any;
        if (cornerSegment.center && cornerSegment.radius) {
          const center = cornerSegment.center;
          const radius = cornerSegment.radius;
          const distFromCenter = Math.sqrt(
            (horsePosition.x - center.x) ** 2 +
              (horsePosition.y - center.y) ** 2
          );
          const innerRadius = radius - trackWidth / 2;
          const outerRadius = radius + trackWidth / 2;
          if (distFromCenter < innerRadius) {
            violationDistance = innerRadius - distFromCenter;
            violationType = "inner";
          } else if (distFromCenter > outerRadius) {
            violationDistance = distFromCenter - outerRadius;
            violationType = "outer";
          }
        }
      }
      if (violationType && violationDistance > 1) {
        this.recordEvent(
          turn,
          horse.horseId.toString(),
          "guardrail_violation",
          `🚧 ${violationType?.toUpperCase()} guardrail violation! Distance: ${violationDistance.toFixed(
            1
          )}m from ${violationType} boundary (Segment: ${horse.segmentIndex})`,
          { x: horse.x, y: horse.y }
        );
        if (violationDistance > 5) {
          this.recordEvent(
            turn,
            horse.horseId.toString(),
            "off_track",
            `⚠️ Severely off track! ${violationDistance.toFixed(
              1
            )}m from ${violationType} guardrail`,
            { x: horse.x, y: horse.y }
          );
        }
      }
    } catch (error) {}
  }

  private detectDirectionDistortion(
    horse: RaceHorse,
    track: RaceTrack,
    turn: number
  ): void {
    if (!track.segments || track.segments.length === 0) {
      return;
    }
    const currentSegment =
      track.segments[horse.segmentIndex % track.segments.length];
    let expectedDirection = 0;
    let distortionAngle = 0;
    try {
      if (currentSegment.type === "line") {
        const lineSegment = currentSegment as any;
        if (lineSegment.start && lineSegment.end) {
          const dx = lineSegment.end.x - lineSegment.start.x;
          const dy = lineSegment.end.y - lineSegment.start.y;
          expectedDirection = Math.atan2(dy, dx);
        }
      } else if (currentSegment.type === "corner") {
        const cornerSegment = currentSegment as any;
        if (cornerSegment.center && cornerSegment.radius) {
          const center = cornerSegment.center;
          const horsePosition = { x: horse.x, y: horse.y };
          const radialAngle = Math.atan2(
            horsePosition.y - center.y,
            horsePosition.x - center.x
          );
          expectedDirection = radialAngle + Math.PI / 2;
          if (cornerSegment.angle < 0) {
            expectedDirection = radialAngle - Math.PI / 2;
          }
        }
      }
      let angleDiff = Math.abs(horse.raceHeading - expectedDirection);
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }
      distortionAngle = angleDiff * (180 / Math.PI);
      if (distortionAngle > 30) {
        const distortionPercent = (distortionAngle / 180) * 100;
        this.recordEvent(
          turn,
          horse.horseId.toString(),
          "direction_distortion",
          `🔄 Direction distortion: ${distortionAngle.toFixed(
            1
          )}° (${distortionPercent.toFixed(1)}%) from optimal path (Segment: ${
            horse.segmentIndex
          })`,
          { x: horse.x, y: horse.y }
        );
      }
    } catch (error) {}
  }

  private detectThreatSources(horse: RaceHorse, turn: number): void {
    if (!horse.raceAnalysis || !horse.raceAnalysis.dirDistanceWithSource) {
      return;
    }

    const dirDistance = horse.raceAnalysis.dirDistanceWithSource;
    const analysis = this.analyzeClosestThreat(dirDistance);

    const { closestThreat, threats, safestDirection } = analysis;

    // 위험도에 따른 이벤트 기록
    if (closestThreat.severity === "critical") {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `🚨 CRITICAL THREAT: ${
          closestThreat.source
        } at ${closestThreat.distance.toFixed(1)}m (${
          closestThreat.direction
        }) - Escape: ${safestDirection}`,
        { x: horse.x, y: horse.y }
      );
    } else if (closestThreat.severity === "high") {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `⚠️ HIGH THREAT: ${
          closestThreat.source
        } at ${closestThreat.distance.toFixed(1)}m (${
          closestThreat.direction
        }) - Recommended: ${safestDirection}`,
        { x: horse.x, y: horse.y }
      );
    }

    const criticalDirections = Object.entries(threats).filter(
      ([_, threat]) =>
        this.calculateThreatSeverity(
          (threat as any).distance,
          (threat as any).source
        ) === "critical"
    );

    if (criticalDirections.length > 1) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `🚨 MULTI-DIRECTIONAL THREAT: ${
          criticalDirections.length
        } critical directions - ${criticalDirections
          .map(
            ([dir, threat]) =>
              `${dir}:${(threat as any).source}@${(
                threat as any
              ).distance.toFixed(1)}m`
          )
          .join(", ")}`,
        { x: horse.x, y: horse.y }
      );
    }

    this.analyzeSourcePatterns(horse, threats, turn);

    if (this.options.verbose && turn % 100 === 0) {
      this.logThreatStatus(horse, analysis, turn);
    }
  }

  private analyzeSourcePatterns(
    horse: RaceHorse,
    threats: any,
    turn: number
  ): void {
    const sourceThreats = {
      wall: [] as string[],
      horse: [] as string[],
      corner: [] as string[],
      speed: [] as string[],
    };

    Object.entries(threats).forEach(([direction, threat]) => {
      const source = (threat as any).source;
      const distance = (threat as any).distance;

      if (distance < 25) {
        if (source === "wall") {
          sourceThreats.wall.push(`${direction}@${distance.toFixed(1)}m`);
        } else if (source === "horse") {
          sourceThreats.horse.push(`${direction}@${distance.toFixed(1)}m`);
        } else if (source === "corner") {
          sourceThreats.corner.push(`${direction}@${distance.toFixed(1)}m`);
        } else if (source === "speed") {
          sourceThreats.speed.push(`${direction}@${distance.toFixed(1)}m`);
        }
      }
    });

    if (sourceThreats.wall.length >= 2) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "guardrail_violation",
        `🚧 WALL SQUEEZE: Multiple wall threats detected - ${sourceThreats.wall.join(
          ", "
        )}`,
        { x: horse.x, y: horse.y }
      );
    }

    if (sourceThreats.horse.length >= 2) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `🐎 HORSE CLUSTER: Multiple horse threats detected - ${sourceThreats.horse.join(
          ", "
        )}`,
        { x: horse.x, y: horse.y }
      );
    }

    if (sourceThreats.corner.length >= 1 && sourceThreats.wall.length >= 1) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "direction_distortion",
        `🌀 CORNER PRESSURE: Corner + wall combination - Corner: ${sourceThreats.corner.join(
          ", "
        )}, Wall: ${sourceThreats.wall.join(", ")}`,
        { x: horse.x, y: horse.y }
      );
    }
  }

  private logThreatStatus(
    horse: RaceHorse,
    analysis: DirectionalThreatAnalysis,
    turn: number
  ): void {
    const { closestThreat, threats, safestDirection } = analysis;

    console.log(`\n🎯 THREAT STATUS (Turn ${turn}) - ${horse.name}:`);
    console.log(
      `   🚨 Primary: ${
        closestThreat.source
      } at ${closestThreat.distance.toFixed(1)}m (${closestThreat.direction})`
    );
    console.log(`   📊 Severity: ${closestThreat.severity.toUpperCase()}`);
    console.log(
      `   🛡️ Escape: ${safestDirection} (${threats[
        safestDirection
      ].distance.toFixed(1)}m clear)`
    );

    const directionSummary = Object.entries(threats)
      .map(([dir, threat]) => {
        const severity = this.calculateThreatSeverity(
          (threat as any).distance,
          (threat as any).source
        );
        const emoji =
          severity === "critical"
            ? "🚨"
            : severity === "high"
            ? "⚠️"
            : severity === "medium"
            ? "🔸"
            : "✅";
        return `${emoji}${dir}:${(threat as any).source}@${(
          threat as any
        ).distance.toFixed(1)}m`;
      })
      .join(" ");

    console.log(`   📍 All: ${directionSummary}`);
  }

  private captureHorseState(horse: RaceHorse): HorseTurnState {
    return {
      id: horse.horseId,
      name: horse.name,
      x: horse.x,
      y: horse.y,
      speed: horse.speed,
      accel: horse.accel,
      stamina: horse.stamina,
      dist: horse.raceDistance,
      closestHitPoints: horse.raceEnvironment.closestRaycasts?.map(
        (r) => r.hitPoint
      ),
      farthestHitPoint: horse.raceEnvironment.farthestRaycast?.hitPoint,
    };
  }

  private analyzeRaceResults(logs: RaceLog[]): void {
    if (!this.currentRaceData) {
      return;
    }
    this.currentRaceData.performance = this.currentRaceData.horses.map(
      (horse) => this.calculateFinalMetrics(horse, logs)
    );
    this.currentRaceData.performance.sort(
      (a, b) => a.finalPosition - b.finalPosition
    );
  }

  private async generateInstantReport(raceId: string): Promise<void> {
    if (!this.currentRaceData || !this.options.verbose) {
      return;
    }
    console.log("\n" + "=".repeat(60));
    console.log("🔥 INSTANT AI PERFORMANCE ANALYSIS 🔥");
    console.log("=".repeat(60));
    this.displayPerformanceRanking();
    this.showAIRecommendations();
    this.displayEventSummary();
    if (this.options.saveReports) {
      await this.saveDetailedReports(raceId);
    }
    this.raceHistory.push({ ...this.currentRaceData });
    console.log("=".repeat(60));
    console.log("✨ Instant analysis completed! ✨");
    console.log("=".repeat(60));
  }

  private displayPerformanceRanking(): void {
    if (!this.currentRaceData) {
      return;
    }
    console.log("\n🏆 Final Race Results:");
    const finishedHorses = this.currentRaceData.performance.filter(
      (m) => m.finished
    );
    const unfinishedHorses = this.currentRaceData.performance.filter(
      (m) => !m.finished
    );
    finishedHorses.sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0));
    unfinishedHorses.sort((a, b) => b.raceDistance - a.raceDistance);
    const allHorses = [...finishedHorses, ...unfinishedHorses];
    allHorses.forEach((metrics, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}.`;
      const efficiency = (metrics.staminaEfficiency * 100).toFixed(1);
      const collisions = this.currentRaceData!.events.filter(
        (e) =>
          e.horseId === metrics.horseId && e.eventType === "collision_avoidance"
      ).length;

      const finishStatus = metrics.finished ? "✅ FINISHED" : "❌ DNF";
      console.log(
        `   ${medal} ${metrics.horseName} (${efficiency}% efficiency, ${collisions} collision avoidances) ${finishStatus}`
      );
    });
  }

  private showAIRecommendations(): void {
    if (!this.currentRaceData) {
      return;
    }
    console.log("\n🧠 AI Optimization Recommendations:");
    const recommendations: string[] = [];
    const finishedCount = this.currentRaceData.events.filter(
      (e) => e.eventType === "finish"
    ).length;
    if (finishedCount === 0) {
      recommendations.push(
        "🚨 CRITICAL: 완주한 말이 없음 - 레이스 로직 또는 maxTurns 조정 필요"
      );
    } else if (finishedCount < this.currentRaceData.horses.length / 2) {
      recommendations.push("⚠️ 완주율 낮음 - 절반 이상의 말이 완주하지 못함");
    }
    const guardrailViolations = this.currentRaceData.events.filter(
      (e) => e.eventType === "guardrail_violation"
    ).length;
    if (guardrailViolations > 10) {
      recommendations.push(
        "🚧 CRITICAL: 가드레일 침범이 매우 빈번 - 트랙 경계 감지 및 회피 로직 강화 필요"
      );
    } else if (guardrailViolations > 5) {
      recommendations.push(
        "🚧 가드레일 침범 다수 발생 - AI 방향 제어 정확도 개선 권장"
      );
    } else if (guardrailViolations > 2) {
      recommendations.push("🚧 가드레일 침범 발생 - 안전 마진 증가 고려");
    } else if (guardrailViolations > 0) {
      recommendations.push("🚧 가드레일 침범 감지됨 - 예방적 안전 조치 권장");
    }
    const offTrackEvents = this.currentRaceData.events.filter(
      (e) => e.eventType === "off_track"
    ).length;
    if (offTrackEvents > 2) {
      recommendations.push(
        "⚠️ 심각한 트랙 이탈 발생 - 긴급 트랙 복귀 로직 추가 필요"
      );
    } else if (offTrackEvents > 0) {
      recommendations.push("⚠️ 트랙 이탈 감지됨 - 트랙 경계 인식 개선 필요");
    }
    const totalCollisions = this.currentRaceData.events.filter(
      (e) => e.eventType === "collision_avoidance"
    ).length;
    if (totalCollisions > 15) {
      recommendations.push(
        "충돌 회피 전략 개선 필요 - 너무 많은 충돌 상황 발생"
      );
    }
    const overtakeAttempts = this.currentRaceData.events.filter(
      (e) => e.eventType === "overtake_attempt"
    ).length;
    const overtakeSuccesses = this.currentRaceData.events.filter(
      (e) => e.eventType === "overtake_success"
    ).length;
    if (overtakeAttempts > 0 && overtakeSuccesses / overtakeAttempts < 0.3) {
      recommendations.push("추월 성공률이 낮음 - 추월 전략 재검토 필요");
    }
    const directionDistortions = this.currentRaceData.events.filter(
      (e) => e.eventType === "direction_distortion"
    ).length;
    if (directionDistortions > 15) {
      recommendations.push(
        "🔄 방향 제어 불안정 - 코너링 및 직선 주행 알고리즘 최적화 필요"
      );
    }
    const avgEfficiency =
      this.currentRaceData.performance.reduce(
        (sum, p) => sum + p.staminaEfficiency,
        0
      ) / this.currentRaceData.performance.length;
    if (avgEfficiency < 0.8) {
      recommendations.push("스태미나 관리 효율성 향상 권장");
    }
    if (recommendations.length === 0) {
      console.log("   ✅ AI performance is optimal!");
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
  }

  private displayEventSummary(): void {
    if (!this.currentRaceData) {
      return;
    }
    console.log("\n📈 Race Event Summary:");
    const eventCounts = {
      collision_avoidance: 0,
      overtake_attempt: 0,
      overtake_success: 0,
      mode_change: 0,
      finish: 0,
      off_track: 0,
      segment_progress: 0,
      guardrail_violation: 0,
      direction_distortion: 0,
      threat_analysis: 0,
      source_pattern: 0,
    };
    this.currentRaceData.events.forEach((event) => {
      eventCounts[event.eventType]++;
    });
    console.log(
      `   🚫 Collision Avoidances: ${eventCounts.collision_avoidance}`
    );
    console.log(`   🏃 Overtake Attempts: ${eventCounts.overtake_attempt}`);
    console.log(`   ✅ Overtake Successes: ${eventCounts.overtake_success}`);
    console.log(`   🔄 Mode Changes: ${eventCounts.mode_change}`);
    console.log(`   🏁 Finishes: ${eventCounts.finish}`);
    console.log(`   ⚠️ Off Track: ${eventCounts.off_track}`);
    console.log(
      `   🚧 Guardrail Violations: ${eventCounts.guardrail_violation}`
    );
    console.log(
      `   🔄 Direction Distortions: ${eventCounts.direction_distortion}`
    );
    console.log(`   📍 Segment Updates: ${eventCounts.segment_progress}`);
    console.log(`   🎯 Threat Analysis: ${eventCounts.threat_analysis}`);
    console.log(`   🔍 Source Patterns: ${eventCounts.source_pattern}`);
  }

  private recordEvent(
    turn: number,
    horseId: string,
    eventType: RaceEvent["eventType"],
    description: string,
    position: { x: number; y: number }
  ): void {
    if (!this.currentRaceData) {
      return;
    }
    this.currentRaceData.events.push({
      turn,
      horseId,
      eventType,
      description,
      position,
    });
  }

  private updatePerformanceMetrics(horse: RaceHorse, turn: number): void {}

  private getCurrentMetrics(horse: RaceHorse): PerformanceMetrics {
    return {
      horseId: horse.horseId.toString(),
      horseName: horse.name,
      averageSpeed: horse.speed,
      maxSpeed: horse.speed,
      staminaEfficiency: horse.stamina > 0 ? horse.speed / horse.stamina : 0,
      modeTransitions: 0,
      collisionAvoidances: 0,
      overtakeAttempts: 0,
      overtakeSuccesses: 0,
      positionChanges: 0,
      lastSpurtDuration: 0,
      totalDecisions: 0,
      finalPosition: 0,
      raceDistance: horse.raceDistance,
      finished: horse.finished,
      directionDistortions: 0,
      avgDirectionDistortion: 0,
      guardrailViolations: 0,
      avgGuardrailDistance: 0,
    };
  }

  private calculateFinalMetrics(
    horse: RaceHorse,
    logs: RaceLog[]
  ): PerformanceMetrics {
    const horseEvents =
      this.currentRaceData?.events.filter(
        (e) => e.horseId === horse.horseId.toString()
      ) || [];
    const directionDistortionEvents = horseEvents.filter(
      (e) => e.eventType === "direction_distortion"
    );
    let avgDirectionDistortion = 0;
    if (directionDistortionEvents.length > 0) {
      const totalDistortion = directionDistortionEvents.reduce((sum, event) => {
        const match = event.description.match(/(\d+\.?\d*)°/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);
      avgDirectionDistortion =
        totalDistortion / directionDistortionEvents.length;
    }
    const guardrailViolationEvents = horseEvents.filter(
      (e) => e.eventType === "guardrail_violation"
    );
    let avgGuardrailDistance = 0;
    if (guardrailViolationEvents.length > 0) {
      const totalViolationDistance = guardrailViolationEvents.reduce(
        (sum, event) => {
          const match = event.description.match(/Distance: (\d+\.?\d*)m/);
          return sum + (match ? parseFloat(match[1]) : 0);
        },
        0
      );
      avgGuardrailDistance =
        totalViolationDistance / guardrailViolationEvents.length;
    }
    return {
      horseId: horse.horseId.toString(),
      horseName: horse.name,
      averageSpeed: horse.speed,
      maxSpeed: horse.speed,
      staminaEfficiency: horse.stamina > 0 ? horse.speed / horse.stamina : 0,
      modeTransitions: horseEvents.filter((e) => e.eventType === "mode_change")
        .length,
      collisionAvoidances: horseEvents.filter(
        (e) => e.eventType === "collision_avoidance"
      ).length,
      overtakeAttempts: horseEvents.filter(
        (e) => e.eventType === "overtake_attempt"
      ).length,
      overtakeSuccesses: horseEvents.filter(
        (e) => e.eventType === "overtake_success"
      ).length,
      positionChanges: 0,
      lastSpurtDuration: 0,
      totalDecisions: logs.length,
      finalPosition: 0,
      raceDistance: horse.raceDistance,
      finished: horse.finished,
      finishTime: this.finishTimes.get(horse.horseId.toString()),
      directionDistortions: directionDistortionEvents.length,
      avgDirectionDistortion: avgDirectionDistortion,
      guardrailViolations: guardrailViolationEvents.length,
      avgGuardrailDistance: avgGuardrailDistance,
    };
  }

  private compareRacePerformances(): void {
    console.log(`📊 Comparing ${this.raceHistory.length} races...`);
  }

  private identifyPatterns(): void {
    console.log("🔍 Identifying performance patterns...");
  }

  private generateImprovementSuggestions(): void {
    console.log("💡 Generating improvement suggestions...");
  }

  private cleanupOldFiles(): void {
    try {
      const dir = path.resolve(process.cwd());
      const files = fs.readdirSync(dir);
      const performanceFiles = files
        .filter((f) => f.startsWith("performance-race_") && f.endsWith(".json"))
        .map((f) => ({
          name: f,
          path: path.join(dir, f),
          timestamp: fs.statSync(path.join(dir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      const csvFiles = files
        .filter(
          (f) => f.startsWith("detailed_analysis_race_") && f.endsWith(".csv")
        )
        .map((f) => ({
          name: f,
          path: path.join(dir, f),
          timestamp: fs.statSync(path.join(dir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      const deleteFiles = (fileList: any[]) => {
        if (fileList.length > 2) {
          const filesToDelete = fileList.slice(2);
          filesToDelete.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
              console.log(`🗑️ Cleaned up old file: ${file.name}`);
            } catch (err) {
              console.warn(`⚠️ Failed to delete ${file.name}:`, err);
            }
          });
        }
      };
      deleteFiles(performanceFiles);
      deleteFiles(csvFiles);
    } catch (err) {
      console.warn("⚠️ Failed to cleanup old files:", err);
    }
  }

  private async saveDetailedReports(raceId: string): Promise<void> {
    if (!this.currentRaceData) {
      return;
    }
    try {
      const saveData = {
        raceId: this.currentRaceData.raceId,
        timestamp: this.currentRaceData.timestamp,
        duration: this.currentRaceData.duration,
        performance: this.currentRaceData.performance,
        events: this.currentRaceData.events,
        horseSummary: this.currentRaceData.horses.map((horse) => ({
          horseId: horse.horseId,
          name: horse.name,
          finalPosition: { x: horse.x, y: horse.y },
          raceDistance: horse.raceDistance,
          finished: horse.finished,
        })),
      };
      const jsonPath = path.resolve(
        process.cwd(),
        `performance-${raceId}.json`
      );
      await fs.promises.writeFile(jsonPath, JSON.stringify(saveData, null, 2));
      const csvPath = path.resolve(
        process.cwd(),
        `detailed_analysis_${raceId}.csv`
      );
      const csvContent = this.generateCSVContent();
      await fs.promises.writeFile(csvPath, csvContent);
      console.log("\n💾 Detailed reports saved:");
      console.log(`   📄 performance-${raceId}.json`);
      console.log(`   📊 detailed_analysis_${raceId}.csv`);
      this.cleanupOldFiles();
    } catch (error) {
      console.error("❌ Failed to save reports:", error);
    }
  }

  private async saveComparativeData(): Promise<void> {
    try {
      const comparativePath = path.resolve(
        process.cwd(),
        `comparative_analysis_${Date.now()}.json`
      );
      await fs.promises.writeFile(
        comparativePath,
        JSON.stringify(this.raceHistory, null, 2)
      );
      console.log(`💾 Comparative analysis saved: ${comparativePath}`);
    } catch (error) {
      console.error("❌ Failed to save comparative data:", error);
    }
  }

  private generateCSVContent(): string {
    if (!this.currentRaceData) {
      return "";
    }
    const headers = [
      "Horse Name",
      "Horse ID",
      "Final Position",
      "Average Speed",
      "Max Speed",
      "Stamina Efficiency",
      "Mode Transitions",
      "Collision Avoidances",
      "Overtake Attempts",
      "Overtake Successes",
      "Race Distance",
      "Guardrail Violations",
      "Direction Distortions",
      "Avg Direction Distortion",
      "Closest Threat Source",
      "Closest Threat Distance",
      "Risk Level",
      "Safest Direction",
    ];
    const rows = this.currentRaceData.performance.map((metrics) => {
      const guardrailViolations = this.currentRaceData!.events.filter(
        (e) =>
          e.horseId === metrics.horseId && e.eventType === "guardrail_violation"
      ).length;

      const horse = this.currentRaceData!.horses.find(
        (h) => h.horseId.toString() === metrics.horseId
      );
      let closestThreatSource = "Unknown";
      let closestThreatDistance = "N/A";
      let riskLevel = "Unknown";
      let safestDirection = "Unknown";

      if (
        horse &&
        horse.raceAnalysis &&
        horse.raceAnalysis.dirDistanceWithSource
      ) {
        try {
          const analysis = this.analyzeClosestThreat(
            horse.raceAnalysis.dirDistanceWithSource
          );
          closestThreatSource = analysis.closestThreat.source;
          closestThreatDistance = analysis.closestThreat.distance.toFixed(1);
          riskLevel = analysis.closestThreat.severity.toUpperCase();
          safestDirection = analysis.safestDirection;
        } catch (error) {}
      }

      return [
        metrics.horseName,
        metrics.horseId,
        metrics.finalPosition,
        metrics.averageSpeed.toFixed(2),
        metrics.maxSpeed.toFixed(2),
        (metrics.staminaEfficiency * 100).toFixed(1) + "%",
        metrics.modeTransitions,
        metrics.collisionAvoidances,
        metrics.overtakeAttempts,
        metrics.overtakeSuccesses,
        metrics.raceDistance.toFixed(0),
        guardrailViolations,
        metrics.directionDistortions,
        metrics.avgDirectionDistortion.toFixed(1) + "°",
        closestThreatSource,
        closestThreatDistance,
        riskLevel,
        safestDirection,
      ];
    });
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  // 가장 가까운 위협 source와 방향 분석
  analyzeClosestThreat(
    dirDistanceWithSource: DirectionalDistanceWithSource
  ): DirectionalThreatAnalysis {
    const threats = {
      front: {
        source: dirDistanceWithSource.front.source,
        distance: dirDistanceWithSource.front.distance,
      },
      left: {
        source: dirDistanceWithSource.left.source,
        distance: dirDistanceWithSource.left.distance,
      },
      right: {
        source: dirDistanceWithSource.right.source,
        distance: dirDistanceWithSource.right.distance,
      },
      frontLeft: {
        source: dirDistanceWithSource.frontLeft.source,
        distance: dirDistanceWithSource.frontLeft.distance,
      },
      frontRight: {
        source: dirDistanceWithSource.frontRight.source,
        distance: dirDistanceWithSource.frontRight.distance,
      },
    };

    let closestThreat: ClosestThreatAnalysis = {
      source: DistanceSource.Unknown,
      direction: "front",
      distance: Infinity,
      severity: "low",
      recommendedAction: "No immediate action required",
    };

    Object.entries(threats).forEach(([direction, threat]) => {
      if (threat.distance < closestThreat.distance) {
        closestThreat = {
          source: threat.source,
          direction: direction as any,
          distance: threat.distance,
          severity: this.calculateThreatSeverity(
            threat.distance,
            threat.source
          ),
          recommendedAction: this.getRecommendedAction(
            threat.distance,
            threat.source,
            direction as any
          ),
        };
      }
    });

    const safestDirection = Object.entries(threats).reduce(
      (safest, [direction, threat]) => {
        const [, safestThreat] = safest;
        return threat.distance > safestThreat.distance
          ? [direction, threat]
          : safest;
      }
    )[0] as any;

    const recommendedStrategy = this.getRecommendedStrategy(
      closestThreat,
      safestDirection,
      threats
    );

    return {
      closestThreat,
      threats,
      safestDirection,
      recommendedStrategy,
    };
  }

  private calculateThreatSeverity(
    distance: number,
    source: DistanceSource
  ): "low" | "medium" | "high" | "critical" {
    let baseThreshold = 50;

    switch (source) {
      case DistanceSource.Wall:
        baseThreshold = 30;
        break;
      case DistanceSource.Horse:
        baseThreshold = 40;
        break;
      case DistanceSource.Speed:
        baseThreshold = 60;
        break;
      case DistanceSource.Corner:
        baseThreshold = 35;
        break;
      default:
        baseThreshold = 50;
    }

    if (distance < baseThreshold * 0.3) return "critical";
    if (distance < baseThreshold * 0.6) return "high";
    if (distance < baseThreshold) return "medium";
    return "low";
  }

  private getRecommendedAction(
    distance: number,
    source: DistanceSource,
    direction: string
  ): string {
    const severity = this.calculateThreatSeverity(distance, source);
    const sourceText =
      source === DistanceSource.Wall
        ? "wall"
        : source === DistanceSource.Horse
        ? "horse"
        : source === DistanceSource.Corner
        ? "corner"
        : "obstacle";

    switch (severity) {
      case "critical":
        return `🚨 EMERGENCY: Immediate ${direction} avoidance required! ${sourceText} at ${distance.toFixed(
          1
        )}m`;
      case "high":
        return `⚠️ HIGH RISK: Strong ${direction} avoidance recommended. ${sourceText} at ${distance.toFixed(
          1
        )}m`;
      case "medium":
        return `🔸 MODERATE: Consider ${direction} avoidance. ${sourceText} at ${distance.toFixed(
          1
        )}m`;
      case "low":
        return `✅ LOW RISK: Monitor ${sourceText} at ${distance.toFixed(1)}m`;
      default:
        return "No action required";
    }
  }

  private getRecommendedStrategy(
    closestThreat: ClosestThreatAnalysis,
    safestDirection: string,
    threats: any
  ): string {
    const { source, direction, distance, severity } = closestThreat;

    if (severity === "critical") {
      return `🚨 EMERGENCY STRATEGY: Immediate evasion to ${safestDirection} direction (${threats[
        safestDirection
      ].distance.toFixed(1)}m clear)`;
    }

    if (severity === "high") {
      return `⚠️ AVOIDANCE STRATEGY: Move towards ${safestDirection} direction to maintain ${threats[
        safestDirection
      ].distance.toFixed(1)}m safety margin`;
    }

    if (severity === "medium") {
      return `🔸 MONITORING STRATEGY: Keep ${safestDirection} direction as escape route (${threats[
        safestDirection
      ].distance.toFixed(1)}m available)`;
    }

    return `✅ CONTINUE STRATEGY: Current path safe, ${safestDirection} direction optimal (${threats[
      safestDirection
    ].distance.toFixed(1)}m clear)`;
  }

  // 위협 분석 결과를 콘솔에 출력
  displayThreatAnalysis(
    analysis: DirectionalThreatAnalysis,
    horseName: string
  ): void {
    if (!this.options.verbose) return;

    console.log(`\n🎯 THREAT ANALYSIS for ${horseName}:`);
    console.log(
      `   🚨 Closest Threat: ${
        analysis.closestThreat.source
      } at ${analysis.closestThreat.distance.toFixed(1)}m (${
        analysis.closestThreat.direction
      })`
    );
    console.log(
      `   📊 Severity: ${analysis.closestThreat.severity.toUpperCase()}`
    );
    console.log(
      `   🎯 Recommended Action: ${analysis.closestThreat.recommendedAction}`
    );
    console.log(
      `   🛡️ Safest Direction: ${analysis.safestDirection} (${analysis.threats[
        analysis.safestDirection
      ].distance.toFixed(1)}m clear)`
    );
    console.log(`   📋 Strategy: ${analysis.recommendedStrategy}`);

    console.log(`   🔍 All Threats:`);
    Object.entries(analysis.threats).forEach(([direction, threat]) => {
      const emoji =
        threat.distance < 20 ? "🚨" : threat.distance < 40 ? "⚠️" : "✅";
      console.log(
        `      ${emoji} ${direction}: ${
          threat.source
        } at ${threat.distance.toFixed(1)}m`
      );
    });
  }

  generateThreatAnalysisSummary(raceHorses: RaceHorse[]): void {
    if (!this.options.verbose) {
      return;
    }
    console.log(`\n🔬 COMPREHENSIVE THREAT ANALYSIS SUMMARY:`);
    console.log(`=`.repeat(50));
    raceHorses.forEach((horse, index) => {
      const dirDistanceWithSource = horse.raceAnalysis.dirDistanceWithSource;
      if (dirDistanceWithSource) {
        const analysis = this.analyzeClosestThreat(dirDistanceWithSource);

        console.log(`\n${index + 1}. ${horse.name}:`);
        console.log(
          `   🎯 Primary Threat: ${analysis.closestThreat.source} (${
            analysis.closestThreat.direction
          }, ${analysis.closestThreat.distance.toFixed(1)}m)`
        );
        console.log(
          `   📊 Risk Level: ${analysis.closestThreat.severity.toUpperCase()}`
        );
        console.log(`   🛡️ Best Escape: ${analysis.safestDirection} direction`);

        // 위험도별 통계
        const criticalThreats = Object.values(analysis.threats).filter(
          (t) =>
            this.calculateThreatSeverity(t.distance, t.source) === "critical"
        ).length;
        const highThreats = Object.values(analysis.threats).filter(
          (t) => this.calculateThreatSeverity(t.distance, t.source) === "high"
        ).length;

        if (criticalThreats > 0) {
          console.log(`   🚨 CRITICAL situations: ${criticalThreats}`);
        }
        if (highThreats > 0) {
          console.log(`   ⚠️ HIGH RISK situations: ${highThreats}`);
        }
      } else {
        console.log(
          `\n${index + 1}. ${horse.name}: No threat analysis data available`
        );
      }
    });
  }

  // 응급 상황 감지
  private isEmergencyDetected(horse: RaceHorse): boolean {
    if (!horse.raceAnalysis || !horse.raceAnalysis.dirDistanceWithSource) {
      return false;
    }

    const dirDistance = horse.raceAnalysis.dirDistanceWithSource;
    const minDistance = Math.min(
      dirDistance.front.distance,
      dirDistance.left.distance,
      dirDistance.right.distance,
      dirDistance.frontLeft.distance,
      dirDistance.frontRight.distance
    );

    return minDistance < 15;
  }

  private performRealTimeThreatAnalysis(horse: RaceHorse, turn: number): void {
    if (!horse.raceAnalysis || !horse.raceAnalysis.dirDistanceWithSource) {
      return;
    }

    const analysis = this.analyzeClosestThreat(
      horse.raceAnalysis.dirDistanceWithSource
    );

    if (
      analysis.closestThreat.severity === "critical" ||
      analysis.closestThreat.severity === "high"
    ) {
      if (this.options.verbose) {
        console.log(`\n🚨 REAL-TIME THREAT ALERT (Turn ${turn}):`);
        console.log(`   🐎 Horse: ${horse.name}`);
        console.log(
          `   ⚠️ Threat: ${
            analysis.closestThreat.source
          } at ${analysis.closestThreat.distance.toFixed(1)}m (${
            analysis.closestThreat.direction
          })`
        );
        console.log(
          `   📊 Severity: ${analysis.closestThreat.severity.toUpperCase()}`
        );
        console.log(
          `   🛡️ Recommended: ${analysis.closestThreat.recommendedAction}`
        );
      }

      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `Real-time threat detected: ${
          analysis.closestThreat.source
        } at ${analysis.closestThreat.distance.toFixed(1)}m (${
          analysis.closestThreat.severity
        })`,
        { x: horse.x, y: horse.y }
      );
    }
  }

  public analyzeHorseThreat(
    horse: RaceHorse
  ): DirectionalThreatAnalysis | null {
    if (!horse.raceAnalysis || !horse.raceAnalysis.dirDistanceWithSource) {
      return null;
    }

    return this.analyzeClosestThreat(horse.raceAnalysis.dirDistanceWithSource);
  }

  public analyzeAllHorsesThreats(
    raceHorses: RaceHorse[]
  ): Map<string, DirectionalThreatAnalysis> {
    const threatAnalysisMap = new Map<string, DirectionalThreatAnalysis>();

    raceHorses.forEach((horse) => {
      const analysis = this.analyzeHorseThreat(horse);
      if (analysis) {
        threatAnalysisMap.set(horse.name, analysis);
      }
    });

    return threatAnalysisMap;
  }

  public getThreatStatistics(raceHorses: RaceHorse[]): {
    totalThreats: number;
    criticalThreats: number;
    highRiskThreats: number;
    mostDangerousSource: DistanceSource;
    averageClosestDistance: number;
  } {
    const allAnalyses = Array.from(
      this.analyzeAllHorsesThreats(raceHorses).values()
    );

    if (allAnalyses.length === 0) {
      return {
        totalThreats: 0,
        criticalThreats: 0,
        highRiskThreats: 0,
        mostDangerousSource: DistanceSource.Unknown,
        averageClosestDistance: 0,
      };
    }

    const criticalThreats = allAnalyses.filter(
      (a) => a.closestThreat.severity === "critical"
    ).length;
    const highRiskThreats = allAnalyses.filter(
      (a) => a.closestThreat.severity === "high"
    ).length;

    const sourceCounts = new Map<DistanceSource, number>();
    allAnalyses.forEach((analysis) => {
      const source = analysis.closestThreat.source;
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });

    const mostDangerousSource = Array.from(sourceCounts.entries()).reduce(
      (a, b) => (a[1] > b[1] ? a : b)
    )[0];

    const averageClosestDistance =
      allAnalyses.reduce(
        (sum, analysis) => sum + analysis.closestThreat.distance,
        0
      ) / allAnalyses.length;

    return {
      totalThreats: allAnalyses.length,
      criticalThreats,
      highRiskThreats,
      mostDangerousSource,
      averageClosestDistance,
    };
  }
}
