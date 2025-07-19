import * as fs from "fs";
import {
  DirectionalDistanceWithSource,
  DistanceSource,
} from "./directionalDistance";
import { Horse } from "./horse";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { TRACK_WIDTH } from "./raceSimulator";
import { RaceTrack } from "./raceTrack";

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
    | "source_pattern"
    | "situation_analysis"; // 🔥 NEW: 상황 분석 이벤트
  description: string;
  position: { x: number; y: number };

  // 🔥 NEW: 상황 컨텍스트 정보
  context?: {
    nearbyHorses: Array<{
      name: string;
      distance: number;
      direction: string;
      speed: number;
    }>;
    wallDistances: { front: number; left: number; right: number };
    currentSpeed: number;
    currentMode: string;
    threatLevel: string;
    decisionMade: string;
    decisionReason: string;
    outcome: string;
  };
}

interface MonitorOptions {
  saveReports?: boolean;
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

interface TurnSnapshot {
  turn: number;
  threats: number;
  critical: number;
  finishedHorses: number;
  avgSpeed: number;
  guardrailViolations: number;
  collisionAvoidances: number;
  raceProgress: number; // percentage of horses finished or near finish

  // 🔥 NEW: Professional Racing Metrics
  trafficDensity: number; // horses per square area
  overtakeEfficiency: number; // successful overtakes / attempts
  riskExposureTime: number; // time spent in high-risk situations
  pacingConsistency: number; // speed variance indicator
  positionStability: number; // how much positions change

  perHorseStats: Map<
    string,
    {
      threats: number;
      critical: number;
      speed: number;
      position: { x: number; y: number };
      progress: number;
      collisionAvoidances: number;

      // 🔥 NEW: Advanced Per-Horse Metrics
      aggressiveness: number; // overtake attempts per opportunity
      defensiveness: number; // collision avoidances per threat
      efficiency: number; // progress per energy spent
      riskTaking: number; // high-risk maneuvers attempted
      consistency: number; // speed/position variance
    }
  >;
}

export class PerformanceMonitor {
  private options: MonitorOptions;
  private events: RaceEvent[] = [];
  private turnSnapshots: TurnSnapshot[] = [];

  private raceStats = {
    totalTurns: 0,
    totalThreats: 0,
    criticalCount: 0,
    highRiskCount: 0,
    deadlockCount: 0,
    collisionAvoidances: 0,
    overtakeAttempts: 0,
    overtakeSuccesses: 0,
    modeChanges: 0,
    finishes: 0,
    offTrackEvents: 0,
    guardrailViolations: 0,
    directionDistortions: 0,
    segmentUpdates: 0,
    perHorse: new Map<
      string,
      {
        threats: number;
        critical: number;
        collisionAvoidances: number;
        finishTurn: number | null;
        criticalBreakdown: {
          wall: number;
          horse: number;
          speed: number;
          corner: number;
          unknown: number;
        };
        positions: Array<{ x: number; y: number; turn: number }>;
      }
    >(),
  };

  constructor(options: MonitorOptions = {}) {
    this.options = {
      saveReports: true,
      ...options,
    };
  }

  async runRaceWithAnalysis(
    track: RaceTrack,
    horses: Horse[]
  ): Promise<RaceLog[]> {
    this.events = [];
    const logs = await this.runSimulationWithMonitoring(track, horses);
    if (this.options.saveReports) {
      await this.generateSituationReport();
    }
    return logs;
  }

  private async runSimulationWithMonitoring(
    track: RaceTrack,
    horses: Horse[]
  ): Promise<RaceLog[]> {
    const raceHorses = horses.map(
      (horse, gate) => new RaceHorse(horse, track.segments || [], gate)
    );
    let turn = 0;
    const logs: RaceLog[] = [];
    const maxTurns = 3000;

    while (raceHorses.some((h) => !h.finished) && turn < maxTurns) {
      this.monitorTurn(turn, raceHorses);
      const horseStates: HorseTurnState[] = [];
      try {
        for (let index = 0; index < raceHorses.length; index++) {
          const horse = raceHorses[index];
          if (!horse.finished) {
            const prevMode = horse.raceAI.getCurrentMode();
            horse.moveOnTrack(turn, raceHorses);
            const currentMode = horse.raceAI.getCurrentMode();
            if (track.isGoal(horse)) {
              horse.finished = true;
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
            }
          }
          horseStates[index] = this.captureHorseState(horse);
        }
      } catch (error) {
        raceHorses.forEach((h) => (h.finished = true));
      }
      logs.push({ turn, horseStates });
      turn++;
    }

    this.collectThreatStatistics(raceHorses, turn);
    return logs;
  }

  private monitorTurn(turn: number, raceHorses: RaceHorse[]): void {
    this.collectThreatStatistics(raceHorses, turn);

    // Collect turn snapshots with progressive intervals
    if (this.shouldCollectSnapshot(turn)) {
      this.collectTurnSnapshot(turn, raceHorses);
    }

    for (const horse of raceHorses) {
      if (!horse.finished) {
        if (turn % 50 === 0 || this.isEmergencyDetected(horse)) {
          this.performRealTimeThreatAnalysis(horse, turn);
        }
      }
    }
  }

  private shouldCollectSnapshot(turn: number): boolean {
    // Collect every 30 turns starting from turn 30
    return turn >= 30 && turn % 30 === 0;
  }

  private collectTurnSnapshot(turn: number, raceHorses: RaceHorse[]): void {
    const activeHorses = raceHorses.filter((h) => !h.finished);
    const finishedHorses = raceHorses.filter((h) => h.finished);

    let currentThreats = 0;
    let currentCritical = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    // 🔥 NEW: Professional Racing Metrics Calculation
    const trafficDensity = this.calculateTrafficDensity(activeHorses);
    const overtakeEfficiency = this.calculateOvertakeEfficiency(turn);
    const riskExposureTime = this.calculateRiskExposureTime(activeHorses);
    const pacingConsistency = this.calculatePacingConsistency(activeHorses);
    const positionStability = this.calculatePositionStability(raceHorses, turn);

    activeHorses.forEach((horse) => {
      if (horse.raceAnalysis?.dirDistanceWithSource) {
        const analysis = this.analyzeClosestThreat(
          horse.raceAnalysis.dirDistanceWithSource
        );
        currentThreats++;
        if (analysis.closestThreat.severity === "critical") {
          currentCritical++;
        }
      }
      totalSpeed += horse.speed;
      speedCount++;
    });

    // Calculate race progress (0-100%)
    const avgDistance =
      raceHorses.reduce((sum, h) => sum + h.raceDistance, 0) /
      raceHorses.length;
    const maxDistance = Math.max(...raceHorses.map((h) => h.raceDistance));
    const raceProgress = Math.min(
      100,
      (finishedHorses.length / raceHorses.length) * 100 +
        (avgDistance / maxDistance) * 10
    );

    const snapshot: TurnSnapshot = {
      turn,
      threats: currentThreats,
      critical: currentCritical,
      finishedHorses: finishedHorses.length,
      avgSpeed: speedCount > 0 ? totalSpeed / speedCount : 0,
      guardrailViolations: this.countRecentGuardrailViolations(turn),
      collisionAvoidances: this.countRecentCollisionAvoidances(turn),
      raceProgress,

      // 🔥 NEW: Professional Metrics
      trafficDensity,
      overtakeEfficiency,
      riskExposureTime,
      pacingConsistency,
      positionStability,

      perHorseStats: this.collectAdvancedPerHorseStats(raceHorses, turn),
    };

    this.turnSnapshots.push(snapshot);
  }

  // 🔥 NEW: Professional Racing Analytics Functions
  private calculateTrafficDensity(horses: RaceHorse[]): number {
    if (horses.length <= 1) return 0;

    // Calculate average distance between horses
    let totalDistance = 0;
    let pairs = 0;

    for (let i = 0; i < horses.length; i++) {
      for (let j = i + 1; j < horses.length; j++) {
        const distance = Math.hypot(
          horses[i].x - horses[j].x,
          horses[i].y - horses[j].y
        );
        totalDistance += distance;
        pairs++;
      }
    }

    const avgDistance = pairs > 0 ? totalDistance / pairs : 0;
    return avgDistance > 0 ? 1000 / avgDistance : 0; // Inverse for density
  }

  private calculateOvertakeEfficiency(currentTurn: number): number {
    const recentAttempts = this.events.filter(
      (e) =>
        e.eventType === "overtake_attempt" &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    const recentSuccesses = this.events.filter(
      (e) =>
        e.eventType === "overtake_success" &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    return recentAttempts > 0 ? (recentSuccesses / recentAttempts) * 100 : 0;
  }

  private calculateRiskExposureTime(horses: RaceHorse[]): number {
    let totalRiskTime = 0;

    horses.forEach((horse) => {
      if (horse.raceAnalysis?.dirDistanceWithSource) {
        const analysis = this.analyzeClosestThreat(
          horse.raceAnalysis.dirDistanceWithSource
        );
        if (
          analysis.closestThreat.severity === "critical" ||
          analysis.closestThreat.severity === "high"
        ) {
          totalRiskTime++;
        }
      }
    });

    return horses.length > 0 ? (totalRiskTime / horses.length) * 100 : 0;
  }

  private calculatePacingConsistency(horses: RaceHorse[]): number {
    if (horses.length === 0) return 0;

    const speeds = horses.map((h) => h.speed);
    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    const variance =
      speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) /
      speeds.length;
    const stdDev = Math.sqrt(variance);

    // Consistency score: higher is more consistent (lower standard deviation)
    return avgSpeed > 0 ? Math.max(0, 100 - (stdDev / avgSpeed) * 100) : 0;
  }

  private calculatePositionStability(
    horses: RaceHorse[],
    currentTurn: number
  ): number {
    // Simplified: measure how much race positions have changed recently
    if (this.turnSnapshots.length < 2) return 100;

    const previousSnapshot = this.turnSnapshots[this.turnSnapshots.length - 1];
    let stabilityScore = 100;

    // Calculate position changes (simplified)
    horses.forEach((horse) => {
      const prevStats = previousSnapshot?.perHorseStats?.get(horse.name);
      if (prevStats) {
        const positionChange = Math.abs(
          horse.raceDistance - prevStats.progress
        );
        stabilityScore -= Math.min(20, positionChange / 10); // Cap impact per horse
      }
    });

    return Math.max(0, stabilityScore);
  }

  private countRecentGuardrailViolations(currentTurn: number): number {
    return this.events.filter(
      (e) =>
        e.eventType === "guardrail_violation" &&
        e.turn >= currentTurn - 50 &&
        e.turn <= currentTurn
    ).length;
  }

  private countRecentCollisionAvoidances(currentTurn: number): number {
    return this.events.filter(
      (e) =>
        e.eventType === "collision_avoidance" &&
        e.turn >= currentTurn - 50 &&
        e.turn <= currentTurn
    ).length;
  }

  private collectAdvancedPerHorseStats(
    raceHorses: RaceHorse[],
    turn: number
  ): Map<
    string,
    {
      threats: number;
      critical: number;
      speed: number;
      position: { x: number; y: number };
      progress: number;
      collisionAvoidances: number;
      aggressiveness: number;
      defensiveness: number;
      efficiency: number;
      riskTaking: number;
      consistency: number;
    }
  > {
    const advancedStats = new Map();

    for (const horse of raceHorses) {
      const horseStats = this.raceStats.perHorse.get(horse.name);

      // 기본 통계 (기존)
      const recentThreats = this.events.filter(
        (e) =>
          e.eventType === "threat_analysis" &&
          e.horseId === horse.name &&
          e.turn >= turn - 30 &&
          e.turn <= turn
      ).length;

      const recentCritical = this.events.filter(
        (e) =>
          e.eventType === "threat_analysis" &&
          e.horseId === horse.name &&
          e.turn >= turn - 30 &&
          e.turn <= turn &&
          e.description.includes("CRITICAL")
      ).length;

      const recentCollisions = this.events.filter(
        (e) =>
          e.eventType === "collision_avoidance" &&
          e.horseId === horse.name &&
          e.turn >= turn - 30 &&
          e.turn <= turn
      ).length;

      // 🔥 NEW: Advanced Professional Metrics
      const aggressiveness = this.calculateAggressiveness(horse, turn);
      const defensiveness = this.calculateDefensiveness(horse, turn);
      const efficiency = this.calculateEfficiency(horse, turn);
      const riskTaking = this.calculateRiskTaking(horse, turn);
      const consistency = this.calculateConsistency(horse, turn);

      advancedStats.set(horse.name, {
        threats: recentThreats,
        critical: recentCritical,
        speed: horse.speed,
        position: { x: horse.x, y: horse.y },
        progress: (horse.segmentIndex / horse.segments.length) * 100,
        collisionAvoidances: recentCollisions,

        // 🔥 NEW: Professional Racing Metrics
        aggressiveness,
        defensiveness,
        efficiency,
        riskTaking,
        consistency,
      });
    }

    return advancedStats;
  }

  // 🔥 NEW: Professional Per-Horse Metric Calculations
  private calculateAggressiveness(
    horse: RaceHorse,
    currentTurn: number
  ): number {
    const overtakeAttempts = this.events.filter(
      (e) =>
        e.eventType === "overtake_attempt" &&
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    const overtakeOpportunities = this.events.filter(
      (e) =>
        e.eventType === "segment_progress" &&
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    // Aggressiveness: attempts per opportunity
    return overtakeOpportunities > 0
      ? (overtakeAttempts / overtakeOpportunities) * 100
      : 0;
  }

  private calculateDefensiveness(
    horse: RaceHorse,
    currentTurn: number
  ): number {
    const collisionAvoidances = this.events.filter(
      (e) =>
        e.eventType === "collision_avoidance" &&
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    const totalThreats = this.events.filter(
      (e) =>
        (e.eventType === "collision_avoidance" ||
          e.eventType === "threat_analysis") &&
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn
    ).length;

    // Defensiveness: successful avoidances per threat
    return totalThreats > 0 ? (collisionAvoidances / totalThreats) * 100 : 0;
  }

  private calculateEfficiency(horse: RaceHorse, currentTurn: number): number {
    // Progress per energy unit (stamina consumption)
    const initialStamina = 100; // Assuming initial stamina
    const staminaUsed = Math.max(1, initialStamina - horse.stamina);
    const progressMade = horse.raceDistance;

    // Efficiency: distance covered per stamina point used
    return staminaUsed > 0 ? progressMade / staminaUsed : 0;
  }

  private calculateRiskTaking(horse: RaceHorse, currentTurn: number): number {
    const highRiskManeuvers = this.events.filter(
      (e) =>
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn &&
        (e.description.includes("CRITICAL") ||
          e.description.includes("HIGH RISK") ||
          e.description.includes("EMERGENCY"))
    ).length;

    const totalManeuvers = this.events.filter(
      (e) =>
        e.horseId === horse.name &&
        e.turn >= currentTurn - 100 &&
        e.turn <= currentTurn &&
        (e.eventType === "overtake_attempt" ||
          e.eventType === "collision_avoidance" ||
          e.eventType === "mode_change")
    ).length;

    // Risk Taking: percentage of maneuvers that were high-risk
    return totalManeuvers > 0 ? (highRiskManeuvers / totalManeuvers) * 100 : 0;
  }

  private calculateConsistency(horse: RaceHorse, currentTurn: number): number {
    // Speed consistency over recent turns
    const horseStats = this.raceStats.perHorse.get(horse.name);
    if (!horseStats || horseStats.positions.length < 5) return 100;

    const recentPositions = horseStats.positions
      .filter((p) => p.turn >= currentTurn - 50 && p.turn <= currentTurn)
      .slice(-10); // Last 10 positions

    if (recentPositions.length < 3) return 100;

    // Calculate speed variance
    const speeds: number[] = [];
    for (let i = 1; i < recentPositions.length; i++) {
      const prev = recentPositions[i - 1];
      const curr = recentPositions[i];
      const distance = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const turnDiff = curr.turn - prev.turn;
      const speed = turnDiff > 0 ? distance / turnDiff : 0;
      speeds.push(speed);
    }

    if (speeds.length === 0) return 100;

    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    const variance =
      speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) /
      speeds.length;
    const stdDev = Math.sqrt(variance);

    // Consistency: 100 - (coefficient of variation * 100)
    const coefficientOfVariation = avgSpeed > 0 ? stdDev / avgSpeed : 0;
    return Math.max(0, 100 - coefficientOfVariation * 100);
  }

  private recordEvent(
    turn: number,
    horseId: string,
    eventType: RaceEvent["eventType"],
    description: string,
    position: { x: number; y: number },
    context?: any
  ): void {
    this.events.push({
      turn,
      horseId,
      eventType,
      description,
      position,
      context,
    });

    switch (eventType) {
      case "collision_avoidance":
        this.raceStats.collisionAvoidances++;
        const horseStatsCollision = this.raceStats.perHorse.get(horseId);
        if (horseStatsCollision) {
          horseStatsCollision.collisionAvoidances++;
        }
        break;
      case "overtake_attempt":
        this.raceStats.overtakeAttempts++;
        break;
      case "overtake_success":
        this.raceStats.overtakeSuccesses++;
        break;
      case "mode_change":
        this.raceStats.modeChanges++;
        break;
      case "finish":
        this.raceStats.finishes++;
        const horseStatsFinish = this.raceStats.perHorse.get(horseId);
        if (horseStatsFinish) {
          horseStatsFinish.finishTurn = turn;
        }
        break;
      case "off_track":
        this.raceStats.offTrackEvents++;
        break;
      case "guardrail_violation":
        this.raceStats.guardrailViolations++;
        break;
      case "direction_distortion":
        this.raceStats.directionDistortions++;
        break;
      case "segment_progress":
        this.raceStats.segmentUpdates++;
        break;
    }
  }

  private detectEvents(
    horse: RaceHorse,
    allHorses: RaceHorse[],
    turn: number,
    track: RaceTrack
  ): void {
    // 🔥 ENHANCED: 실제 거리 데이터와 방향성 분석
    const nearbyHorsesObj = horse.raceEnv.nearbyHorses;
    const proximityAnalysis = this.analyzeProximityThreats(
      nearbyHorsesObj,
      horse
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

    // 🎯 ENHANCED: 전문적인 충돌 위험도 분석
    this.analyzeCollisionRisks(proximityAnalysis, horse, turn);

    // 🏁 ENHANCED: 정교한 추월 상황 분석
    this.analyzeOvertakeScenarios(proximityAnalysis, horse, turn);

    // 🔥 NEW: 상황별 의사결정 분석
    this.analyzeSituationalDecision(horse, proximityAnalysis, turn);

    this.detectGuardrailViolations(horse, track, turn);
    this.detectDirectionDistortion(horse, track, turn);
    this.detectThreatSources(horse, turn);
  }

  // 🔥 NEW: 전문적인 근접성 위협 분석
  private analyzeProximityThreats(
    nearbyHorsesObj: any,
    currentHorse: RaceHorse
  ) {
    const analysis = {
      immediateThreats: [] as Array<{
        horse: RaceHorse;
        distance: number;
        direction: string;
        severity: string;
      }>,
      totalNearbyCount: 0,
      averageDistance: 0,
      closestDistance: Infinity,
      directionDistribution: { front: 0, left: 0, right: 0 },
      speedDifferentials: [] as Array<{
        horse: RaceHorse;
        speedDiff: number;
        isOvertaking: boolean;
      }>,
    };

    if (!nearbyHorsesObj) {
      return analysis;
    }

    // nearbyHorsesObj 구조: { front: RaceHorse|null, left: RaceHorse|null, right: RaceHorse|null }
    const directions = ["front", "left", "right"] as const;
    const allDistances: number[] = [];

    directions.forEach((direction) => {
      const nearbyHorse = nearbyHorsesObj[direction];
      if (!nearbyHorse) return;

      // 거리 계산 (두 말 사이의 유클리드 거리)
      const distance = Math.sqrt(
        Math.pow(nearbyHorse.x - currentHorse.x, 2) +
          Math.pow(nearbyHorse.y - currentHorse.y, 2)
      );

      allDistances.push(distance);
      analysis.totalNearbyCount++;

      // 방향 분포 업데이트
      analysis.directionDistribution[direction]++;

      // 위험도 계산
      const severity = this.calculateProximitySeverity(distance, direction);

      // 속도 차이 분석
      const speedDiff = nearbyHorse.speed - currentHorse.speed;
      const isOvertaking =
        speedDiff > 0 && nearbyHorse.raceDistance < currentHorse.raceDistance;

      analysis.speedDifferentials.push({
        horse: nearbyHorse,
        speedDiff,
        isOvertaking,
      });

      analysis.immediateThreats.push({
        horse: nearbyHorse,
        distance: distance,
        direction: direction,
        severity,
      });

      analysis.closestDistance = Math.min(analysis.closestDistance, distance);
    });

    analysis.averageDistance =
      allDistances.length > 0
        ? allDistances.reduce((sum, d) => sum + d, 0) / allDistances.length
        : 0;

    return analysis;
  }

  // 🔥 NEW: 충돌 위험 정교 분석
  private analyzeCollisionRisks(
    proximityAnalysis: any,
    horse: RaceHorse,
    turn: number
  ): void {
    const criticalThreats = proximityAnalysis.immediateThreats.filter(
      (t: any) => t.severity === "critical" && t.distance < 15
    );

    const highRiskThreats = proximityAnalysis.immediateThreats.filter(
      (t: any) => t.severity === "high" && t.distance < 25
    );

    // 🚨 CRITICAL: 즉시 충돌 위험
    if (criticalThreats.length > 0) {
      const avgCriticalDistance =
        criticalThreats.reduce((sum: number, t: any) => sum + t.distance, 0) /
        criticalThreats.length;
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `🚨 CRITICAL COLLISION RISK: ${
          criticalThreats.length
        } horses within ${avgCriticalDistance.toFixed(
          1
        )}m - Emergency evasion required`,
        { x: horse.x, y: horse.y }
      );
    }

    // ⚠️ HIGH: 고위험 상황
    if (highRiskThreats.length > 0) {
      const directions = highRiskThreats
        .map((t: any) => t.direction)
        .join(", ");
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `⚠️ HIGH COLLISION RISK: ${highRiskThreats.length} horses threatening from [${directions}] - Caution advised`,
        { x: horse.x, y: horse.y }
      );
    }

    // 📊 MEDIUM: 밀집 상황 분석
    if (
      proximityAnalysis.totalNearbyCount >= 3 &&
      proximityAnalysis.averageDistance < 35
    ) {
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "collision_avoidance",
        `🚦 TRAFFIC CONGESTION: ${
          proximityAnalysis.totalNearbyCount
        } horses clustered (avg: ${proximityAnalysis.averageDistance.toFixed(
          1
        )}m)`,
        { x: horse.x, y: horse.y }
      );
    }
  }

  // 🔥 NEW: 추월 시나리오 정교 분석
  private analyzeOvertakeScenarios(
    proximityAnalysis: any,
    horse: RaceHorse,
    turn: number
  ): void {
    const overtakingHorses = proximityAnalysis.speedDifferentials.filter(
      (sd: any) => sd.isOvertaking
    );
    const beingOvertaken = proximityAnalysis.speedDifferentials.filter(
      (sd: any) =>
        sd.speedDiff < -2 && sd.horse.raceDistance > horse.raceDistance
    );

    // 🏁 능동적 추월 시도
    if (overtakingHorses.length > 0) {
      const avgSpeedAdv =
        overtakingHorses.reduce(
          (sum: number, ot: any) => sum + ot.speedDiff,
          0
        ) / overtakingHorses.length;
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "overtake_attempt",
        `🏁 ACTIVE OVERTAKE: Passing ${
          overtakingHorses.length
        } horses (speed advantage: +${avgSpeedAdv.toFixed(1)})`,
        { x: horse.x, y: horse.y }
      );
    }

    // 🛡️ 수비적 추월 대응
    if (beingOvertaken.length > 0) {
      const threatLevel = beingOvertaken.some((bo: any) => bo.speedDiff < -5)
        ? "HIGH"
        : "MEDIUM";
      this.recordEvent(
        turn,
        horse.horseId.toString(),
        "overtake_attempt",
        `🛡️ DEFENSIVE POSITION: Being challenged by ${beingOvertaken.length} horses - Threat: ${threatLevel}`,
        { x: horse.x, y: horse.y }
      );
    }
  }

  // 🔥 NEW: 상황별 의사결정 분석
  private analyzeSituationalDecision(
    horse: RaceHorse,
    proximityAnalysis: any,
    turn: number
  ): void {
    // 주목할만한 상황들만 기록
    const isInterestingSituation =
      proximityAnalysis.totalNearbyCount >= 1 || // 🔥 1마리 이상 근처에 있음 (완화)
      proximityAnalysis.closestDistance < 40 || // 🔥 거리 기준 완화
      horse.speed < 8 || // 🔥 속도 기준 완화
      turn % 50 === 0; // 🔥 더 자주 샘플링

    if (!isInterestingSituation) return;

    const currentMode = horse.raceAI?.getCurrentMode() || "unknown";
    const wallDistances = this.getWallDistances(horse);

    // 상황 분석
    const situationContext = {
      nearbyHorses: proximityAnalysis.immediateThreats.map((threat: any) => ({
        name: threat.horse?.name || "Unknown",
        distance: threat.distance,
        direction: threat.direction,
        speed: threat.horse?.speed || 0,
      })),
      wallDistances,
      currentSpeed: horse.speed,
      currentMode,
      threatLevel: this.assessOverallThreatLevel(
        proximityAnalysis,
        wallDistances
      ),
      decisionMade: this.inferDecisionMade(horse, proximityAnalysis),
      decisionReason: this.inferDecisionReason(
        proximityAnalysis,
        wallDistances,
        horse
      ),
      outcome: this.assessDecisionOutcome(horse, turn),
    };

    // 의미있는 상황만 기록
    if (situationContext.threatLevel !== "none") {
      this.recordEvent(
        turn,
        horse.name, // 🔥 FIX: horseId 대신 name 사용
        "situation_analysis",
        this.generateSituationDescription(situationContext),
        { x: horse.x, y: horse.y },
        situationContext
      );
    }
  }

  private getWallDistances(horse: RaceHorse): {
    front: number;
    left: number;
    right: number;
  } {
    // 벽까지의 거리 계산 (간단화)
    if (horse.raceAnalysis?.dirDistanceWithSource) {
      const dirDist = horse.raceAnalysis.dirDistanceWithSource;
      return {
        front: dirDist.front?.source === "wall" ? dirDist.front.distance : 999,
        left: dirDist.left?.source === "wall" ? dirDist.left.distance : 999,
        right: dirDist.right?.source === "wall" ? dirDist.right.distance : 999,
      };
    }
    return { front: 999, left: 999, right: 999 };
  }

  private assessOverallThreatLevel(
    proximityAnalysis: any,
    wallDistances: any
  ): string {
    const criticalThreats = proximityAnalysis.immediateThreats.filter(
      (t: any) => t.severity === "critical"
    ).length;
    const highThreats = proximityAnalysis.immediateThreats.filter(
      (t: any) => t.severity === "high"
    ).length;
    const minWallDistance = Math.min(
      wallDistances.front,
      wallDistances.left,
      wallDistances.right
    );

    if (criticalThreats > 0 || minWallDistance < 10) return "critical";
    if (highThreats > 0 || minWallDistance < 20) return "high";
    if (proximityAnalysis.totalNearbyCount > 0 || minWallDistance < 40)
      return "medium";
    return "none";
  }

  private inferDecisionMade(horse: RaceHorse, proximityAnalysis: any): string {
    const prevSpeed = horse.speed; // 이전 속도와 비교해야 하지만 간단화

    if (horse.speed < 3) return "급감속";
    if (horse.speed < 8) return "감속";
    if (horse.speed > 15) return "가속";

    // 방향 변화는 더 복잡한 로직이 필요하지만 간단화
    const leftThreats = proximityAnalysis.immediateThreats.filter((t: any) =>
      t.direction.includes("left")
    ).length;
    const rightThreats = proximityAnalysis.immediateThreats.filter((t: any) =>
      t.direction.includes("right")
    ).length;

    if (leftThreats > rightThreats) return "우회전 시도";
    if (rightThreats > leftThreats) return "좌회전 시도";

    return "직진 유지";
  }

  private inferDecisionReason(
    proximityAnalysis: any,
    wallDistances: any,
    horse: RaceHorse
  ): string {
    const criticalThreats = proximityAnalysis.immediateThreats.filter(
      (t: any) => t.severity === "critical"
    );
    const minWallDistance = Math.min(
      wallDistances.front,
      wallDistances.left,
      wallDistances.right
    );

    if (criticalThreats.length > 0) {
      const threatDirections = criticalThreats
        .map((t: any) => t.direction)
        .join(", ");
      return `치명적 위협 회피 (${threatDirections} 방향에서 ${criticalThreats.length}개 위협)`;
    }

    if (minWallDistance < 15) {
      return `벽면 접근 경고 (${minWallDistance.toFixed(1)}m 거리)`;
    }

    if (proximityAnalysis.totalNearbyCount >= 3) {
      return `교통 혼잡 상황 (주변 ${proximityAnalysis.totalNearbyCount}마리)`;
    }

    if (horse.speed < 5) {
      return `저속 주행 상황 (현재 ${horse.speed.toFixed(1)} 속도)`;
    }

    return "일반 주행 상황";
  }

  private assessDecisionOutcome(horse: RaceHorse, turn: number): string {
    // 간단한 결과 평가 (다음 턴과 비교해야 정확하지만 현재 상태로 추정)
    if (horse.speed < 2) return "정지/교착상태";
    if (horse.speed < 5) return "저속 진행";
    if (horse.speed > 12) return "원활한 진행";
    return "보통 진행";
  }

  private generateSituationDescription(context: any): string {
    // 🎯 스토리텔링 방식의 상황 설명
    let story = "";

    // 1. 위험도에 따른 시작 문구
    const threatOpenings = {
      critical: "🚨 위급상황!",
      high: "⚠️ 주의상황:",
      medium: "📊 일반상황:",
      none: "✅ 안전상황:",
    };
    story +=
      threatOpenings[context.threatLevel as keyof typeof threatOpenings] ||
      "상황:";

    // 2. 주변 말 상황을 자연스럽게 설명
    if (context.nearbyHorses.length > 0) {
      const nearbyDescriptions: string[] = [];
      context.nearbyHorses.forEach((horse: any) => {
        const distance = horse.distance;
        const direction = horse.direction;

        let proximityDesc = "";
        if (distance < 5) proximityDesc = "바로";
        else if (distance < 10) proximityDesc = "아주 가까운";
        else if (distance < 20) proximityDesc = "가까운";
        else proximityDesc = "멀리 있는";

        let directionDesc = "";
        if (direction === "front") directionDesc = "앞에";
        else if (direction === "left") directionDesc = "왼쪽에";
        else if (direction === "right") directionDesc = "오른쪽에";
        else directionDesc = "근처에";

        nearbyDescriptions.push(
          `${proximityDesc} ${directionDesc} ${horse.name}(${distance.toFixed(
            1
          )}m)`
        );
      });

      story += ` ${nearbyDescriptions.join(", ")}가 있어서`;
    } else {
      story += " 주변이 비어있어서";
    }

    // 3. 벽 위험도 체크
    const minWall = Math.min(
      context.wallDistances.front,
      context.wallDistances.left,
      context.wallDistances.right
    );
    if (minWall < 30) {
      story += ` 벽도 ${minWall.toFixed(0)}m로 가까워서`;
    }

    // 4. 결정과 이유를 자연스럽게 연결
    const decisionMap: { [key: string]: string } = {
      감속: "속도를 줄였다",
      가속: "속도를 높였다",
      급감속: "급하게 멈췄다",
      "좌회전 시도": "왼쪽으로 피하려 했다",
      "우회전 시도": "오른쪽으로 피하려 했다",
      "직진 유지": "그대로 직진했다",
    };

    const action = decisionMap[context.decisionMade] || context.decisionMade;
    story += ` ${action}.`;

    // 5. 속도 정보 추가
    story += ` (현재속도: ${context.currentSpeed.toFixed(1)}km/h)`;

    return story;
  }

  // 🔥 NEW: 유틸리티 함수들
  private findHorseById(
    horseId: number,
    currentHorse: RaceHorse
  ): RaceHorse | null {
    // Implementation needed - find horse by ID from race context
    return null; // Placeholder
  }

  private determineDirection(
    nearbyHorsesObj: any,
    targetHorse: RaceHorse
  ): string | null {
    if (nearbyHorsesObj.front === targetHorse) return "front";
    if (nearbyHorsesObj.left === targetHorse) return "left";
    if (nearbyHorsesObj.right === targetHorse) return "right";
    return null;
  }

  private calculateProximitySeverity(
    distance: number,
    direction: string | null
  ): string {
    // 방향별 위험도 가중치
    const directionMultiplier = {
      front: 1.5, // 정면이 가장 위험
      left: 1.2,
      right: 1.2,
      unknown: 1.0,
    };

    const multiplier =
      directionMultiplier[direction as keyof typeof directionMultiplier] || 1.0;
    const adjustedDistance = distance / multiplier;

    if (adjustedDistance < 10) return "critical";
    if (adjustedDistance < 20) return "high";
    if (adjustedDistance < 35) return "medium";
    return "low";
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
      closestHitPoints: horse.raceEnv.closestRaycasts?.map((r) => r.hitPoint),
      farthestHitPoint: horse.raceEnv.farthestRaycast?.hitPoint,
    };
  }

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

  collectThreatStatistics(raceHorses: RaceHorse[], turn: number): void {
    this.raceStats.totalTurns++;

    raceHorses.forEach((horse) => {
      if (!horse.raceAnalysis?.dirDistanceWithSource) return;

      const analysis = this.analyzeClosestThreat(
        horse.raceAnalysis.dirDistanceWithSource
      );
      if (!analysis) return;

      this.raceStats.totalThreats++;

      if (analysis.closestThreat.severity === "critical") {
        this.raceStats.criticalCount++;
      } else if (analysis.closestThreat.severity === "high") {
        this.raceStats.highRiskCount++;
      }

      if (horse.speed < 1.0 && analysis.closestThreat.distance < 10) {
        this.raceStats.deadlockCount++;
      }

      if (!this.raceStats.perHorse.has(horse.name)) {
        this.raceStats.perHorse.set(horse.name, {
          threats: 0,
          critical: 0,
          collisionAvoidances: 0,
          finishTurn: null,
          criticalBreakdown: {
            wall: 0,
            horse: 0,
            speed: 0,
            corner: 0,
            unknown: 0,
          },
          positions: [],
        });
      }

      const horseStats = this.raceStats.perHorse.get(horse.name)!;
      horseStats.threats++;
      horseStats.positions.push({ x: horse.x, y: horse.y, turn });

      if (analysis.closestThreat.severity === "critical") {
        horseStats.critical++;

        switch (analysis.closestThreat.source) {
          case "wall":
            horseStats.criticalBreakdown.wall++;
            break;
          case "horse":
            horseStats.criticalBreakdown.horse++;
            break;
          case "speed":
            horseStats.criticalBreakdown.speed++;
            break;
          case "corner":
            horseStats.criticalBreakdown.corner++;
            break;
          default:
            horseStats.criticalBreakdown.unknown++;
            break;
        }
      }
    });
  }

  async generateSituationReport(): Promise<void> {
    const filename = "race-statistics.txt";

    let report = "";
    report += "🎯 SITUATIONAL DECISION ANALYSIS\n";
    report += "-".repeat(50) + "\n";

    const situationEvents = this.events.filter(
      (e) => e.eventType === "situation_analysis"
    );

    if (situationEvents.length > 0) {
      report += `Total Situations Analyzed: ${situationEvents.length}\n\n`;

      // 말별로 흥미로운 상황들 표시
      const horseNames = Array.from(this.raceStats.perHorse.keys());
      horseNames.forEach((horseName) => {
        const horseSituations = situationEvents
          .filter((e) => e.horseId === horseName)
          .slice(0, 10); // 처음 10개

        if (horseSituations.length > 0) {
          report += `\n🏇 ${horseName}의 실제 상황들:\n`;
          report += "-".repeat(40) + "\n";

          horseSituations.forEach((situation, index) => {
            const turnInfo = `Turn ${situation.turn}`;
            const contextInfo = situation.context
              ? ` (${situation.context.threatLevel})`
              : "";

            report += `${index + 1}. 📍 ${turnInfo}${contextInfo}\n`;
            report += `   ${situation.description}\n`;

            if (situation.context) {
              // 결과를 더 구체적으로 표현
              let outcomeEmoji = "";
              if (situation.context.outcome.includes("원활"))
                outcomeEmoji = "🚀";
              else if (situation.context.outcome.includes("저속"))
                outcomeEmoji = "🐌";
              else if (situation.context.outcome.includes("교착"))
                outcomeEmoji = "🛑";
              else outcomeEmoji = "📊";

              report += `   ${outcomeEmoji} 결과: ${situation.context.outcome}\n`;
            }
            report += "\n";
          });
        }
      });

      // 위험도별 통계
      const criticalSituations = situationEvents.filter(
        (e) => e.context?.threatLevel === "critical"
      ).length;
      const highSituations = situationEvents.filter(
        (e) => e.context?.threatLevel === "high"
      ).length;
      const mediumSituations = situationEvents.filter(
        (e) => e.context?.threatLevel === "medium"
      ).length;

      report += `\n📊 위험도별 상황 통계:\n`;
      report += `  🚨 Critical Situations: ${criticalSituations}\n`;
      report += `  ⚠️ High Risk Situations: ${highSituations}\n`;
      report += `  📊 Medium Risk Situations: ${mediumSituations}\n`;
    } else {
      report += "No situational analysis data available.\n";
    }

    try {
      await fs.promises.writeFile(filename, report, "utf-8");
      console.log(`🎯 상황 분석 리포트가 ${filename}에 저장되었습니다.`);
    } catch (error) {
      console.error("리포트 저장 실패:", error);
    }
  }
}
