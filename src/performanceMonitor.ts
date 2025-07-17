import * as fs from "fs";
import * as path from "path";
import { Horse } from "./horse";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { TRACK_WIDTH } from "./raceSimulator";
import { RaceTrack } from "./raceTrack";

// 레이스 데이터 인터페이스
interface RaceData {
  raceId: string;
  timestamp: number;
  horses: RaceHorse[];
  logs: RaceLog[];
  performance: PerformanceMetrics[];
  events: RaceEvent[];
  duration: number;
}

// 성능 메트릭
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
  directionDistortions: number; // 새로 추가: 방향 왜곡 횟수
  avgDirectionDistortion: number; // 새로 추가: 평균 방향 왜곡률
}

// 레이스 이벤트
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
    | "direction_distortion";
  description: string;
  position: { x: number; y: number };
}

// 설정 옵션
interface MonitorOptions {
  realTimeInterval?: number;
  saveReports?: boolean;
  enableWebStream?: boolean;
  verbose?: boolean;
}

export class PerformanceAnalysis {
  private raceHistory: RaceData[] = [];
  private currentRaceData: RaceData | null = null;
  private options: MonitorOptions;
  private startTime: number = 0;
  private finishTimes: Map<string, number> = new Map(); // 완주 시간 추적

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

    // 1. 초기 설정
    this.initializeRace(horses, finalRaceId);

    // 2. 실시간 모니터링과 함께 시뮬레이션 실행
    const logs = this.runSimulationWithMonitoring(track, horses);

    // 3. 자동 분석 및 리포트
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
    const maxTurns = 3000; // 기존 1000 -> 3000으로 증가

    if (this.options.verbose) {
      console.log("🏁 Race starting with live AI monitoring...");
      console.log(
        `🎯 Target distance: ${track.raceLength}m, Max turns: ${maxTurns}`
      );
    }

    // 초기 말 등록
    this.currentRaceData!.horses = raceHorses;

    while (raceHorses.some((h) => !h.finished) && turn < maxTurns) {
      // 매 턴 자동 모니터링
      this.monitorTurn(turn, raceHorses);

      // 시뮬레이션 로직
      const horseStates: HorseTurnState[] = [];

      try {
        for (let index = 0; index < raceHorses.length; index++) {
          const horse = raceHorses[index];

          if (!horse.finished) {
            // 성능 추적 시작
            this.trackHorsePerformance(horse, turn);

            // AI 로직 실행
            const prevMode = horse.raceAI.getCurrentMode();
            horse.moveOnTrack(turn, raceHorses);
            const currentMode = horse.raceAI.getCurrentMode();

            // 🎯 완주 체크 (중요!)
            if (track.isGoal(horse)) {
              horse.finished = true;
              this.finishTimes.set(horse.horseId.toString(), turn); // 완주 시간 기록
            }

            // 모드 변경 감지
            if (prevMode !== currentMode) {
              this.recordEvent(
                turn,
                horse.horseId.toString(),
                "mode_change",
                `Mode changed from ${prevMode} to ${currentMode}`,
                { x: horse.x, y: horse.y }
              );
            }

            // 이벤트 자동 감지
            this.detectEvents(horse, raceHorses, turn, track);

            // 골인 체크
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

          // 상태 캡처
          horseStates[index] = this.captureHorseState(horse);
        }
      } catch (error) {
        console.error(`❌ Error at turn ${turn}:`, error);
        // 에러 발생시 모든 말 완주 처리
        raceHorses.forEach((h) => (h.finished = true));
      }

      logs.push({ turn, horseStates });
      turn++;

      // 실시간 출력 (자동)
      if (this.options.verbose && turn % this.options.realTimeInterval! === 0) {
        this.displayLiveUpdate(turn, raceHorses);
      }
    }

    this.currentRaceData!.logs = logs;
    this.currentRaceData!.duration = Date.now() - this.startTime;

    // 완주 상황 분석
    const finishedHorses = raceHorses.filter((h) => h.finished);
    const unfinishedHorses = raceHorses.filter((h) => !h.finished);

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

  /**
   * 📊 다중 레이스 비교 분석
   */
  async generateComparativeReport(): Promise<void> {
    if (this.raceHistory.length === 0) {
      console.log("⚠️ No race data available for comparison");
      return;
    }

    console.log("🔬 Generating Multi-Race Comparative Analysis...");

    // 모든 레이스 데이터 비교
    this.compareRacePerformances();
    this.identifyPatterns();
    this.generateImprovementSuggestions();

    if (this.options.saveReports) {
      await this.saveComparativeData();
    }
  }

  /**
   * 초기 설정
   */
  private initializeRace(horses: Horse[], raceId: string): void {
    this.startTime = Date.now();
    this.finishTimes.clear(); // 완주 시간 맵 초기화
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

  /**
   * 매 턴 모니터링
   */
  private monitorTurn(turn: number, raceHorses: RaceHorse[]): void {
    // 성능 데이터 업데이트
    for (const horse of raceHorses) {
      if (!horse.finished) {
        this.updatePerformanceMetrics(horse, turn);
      }
    }
  }

  /**
   * 말 성능 추적
   */
  private trackHorsePerformance(horse: RaceHorse, turn: number): void {
    // 스태미나 효율성, 속도 변화 등을 추적
    const efficiency = horse.stamina > 0 ? horse.speed / horse.stamina : 0;

    // 성능 메트릭 업데이트는 updatePerformanceMetrics에서 처리
  }

  /**
   * 이벤트 자동 감지
   */
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

    // 세그먼트 변경 감지
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

    // 충돌 회피 감지
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

    // 추월 시도 감지
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

    // 🚧 가드레일 침범 감지
    this.detectGuardrailViolations(horse, track, turn);

    // 🔄 방향 왜곡 감지
    this.detectDirectionDistortion(horse, track, turn);
  }

  /**
   * 가드레일 침범 감지
   */
  private detectGuardrailViolations(
    horse: RaceHorse,
    track: RaceTrack,
    turn: number
  ): void {
    if (!track.segments || track.segments.length === 0) return;

    const horsePosition = { x: horse.x, y: horse.y };
    const currentSegment =
      track.segments[horse.segmentIndex % track.segments.length];

    // 기본 트랙 폭 설정 (조정 가능)
    const trackWidth = TRACK_WIDTH;
    let violationDistance = 0;
    let violationType: "inner" | "outer" | null = null;

    try {
      if (currentSegment.type === "line") {
        // 직선 구간에서의 가드레일 침범 체크
        const lineSegment = currentSegment as any;
        if (lineSegment.start && lineSegment.end) {
          const segmentStart = lineSegment.start;
          const segmentEnd = lineSegment.end;

          // 직선과 점 사이의 거리 계산
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

            // 트랙 폭의 절반을 넘으면 침범
            if (distToLine > trackWidth / 2) {
              violationDistance = distToLine - trackWidth / 2;
              violationType = "outer"; // 직선에서는 외측 침범으로 간주
            }
          }
        }
      } else if (currentSegment.type === "corner") {
        // 코너 구간에서의 가드레일 침범 체크
        const cornerSegment = currentSegment as any;
        if (cornerSegment.center && cornerSegment.radius) {
          const center = cornerSegment.center;
          const radius = cornerSegment.radius;

          // 말과 코너 중심 사이의 거리
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

      // 가드레일 침범 기록 (1m 이상 침범시에만)
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

        // 심각한 침범의 경우 (5m 이상) off_track 이벤트도 기록
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
    } catch (error) {
      // 에러 발생시 조용히 무시 (로그 스팸 방지)
    }
  }

  /**
   * 방향 왜곡 감지
   */
  private detectDirectionDistortion(
    horse: RaceHorse,
    track: RaceTrack,
    turn: number
  ): void {
    if (!track.segments || track.segments.length === 0) return;

    const currentSegment =
      track.segments[horse.segmentIndex % track.segments.length];
    let expectedDirection = 0;
    let distortionAngle = 0;

    try {
      if (currentSegment.type === "line") {
        // 직선 구간에서의 올바른 방향 계산
        const lineSegment = currentSegment as any;
        if (lineSegment.start && lineSegment.end) {
          const dx = lineSegment.end.x - lineSegment.start.x;
          const dy = lineSegment.end.y - lineSegment.start.y;
          expectedDirection = Math.atan2(dy, dx);
        }
      } else if (currentSegment.type === "corner") {
        // 코너 구간에서의 올바른 방향 계산
        const cornerSegment = currentSegment as any;
        if (cornerSegment.center && cornerSegment.radius) {
          const center = cornerSegment.center;
          const horsePosition = { x: horse.x, y: horse.y };

          // 코너의 접선 방향 계산
          const radialAngle = Math.atan2(
            horsePosition.y - center.y,
            horsePosition.x - center.x
          );

          // 접선 방향 (코너 방향에 따라 +90도 또는 -90도)
          expectedDirection = radialAngle + Math.PI / 2;

          // 코너의 회전 방향 고려 (시계방향/반시계방향)
          if (cornerSegment.angle < 0) {
            expectedDirection = radialAngle - Math.PI / 2;
          }
        }
      }

      // 말의 현재 주행 방향과 예상 방향 사이의 각도 차이 계산
      let angleDiff = Math.abs(horse.raceHeading - expectedDirection);

      // 각도를 0-π 범위로 정규화
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }

      distortionAngle = angleDiff * (180 / Math.PI); // 라디안을 도수로 변환

      // 왜곡률이 30도 이상인 경우 기록
      if (distortionAngle > 30) {
        const distortionPercent = (distortionAngle / 180) * 100; // 왜곡률을 백분율로 변환

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
    } catch (error) {
      // 에러 발생시 조용히 무시
    }
  }

  /**
   * 말 상태 캡처
   */
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

  /**
   * 실시간 업데이트 표시
   */
  private displayLiveUpdate(turn: number, raceHorses: RaceHorse[]): void {
    const activeHorses = raceHorses
      .filter((h) => !h.finished)
      .sort((a, b) => b.raceDistance - a.raceDistance)
      .slice(0, 3);

    console.log(`📊 Turn ${turn} - Performance Update:`);

    activeHorses.forEach((horse, index) => {
      const metrics = this.getCurrentMetrics(horse);
      const position = index + 1;
      const efficiency = (metrics.staminaEfficiency * 100).toFixed(1);
      const mode = horse.raceAI.getCurrentMode();

      console.log(
        `   ${position}. ${horse.name}: ${horse.raceDistance.toFixed(
          0
        )}m | Seg:${horse.segmentIndex} | ${efficiency}% eff | ${mode} mode`
      );
    });
  }

  /**
   * 레이스 결과 분석
   */
  private analyzeRaceResults(logs: RaceLog[]): void {
    if (!this.currentRaceData) return;

    // 최종 성능 메트릭 계산
    this.currentRaceData.performance = this.currentRaceData.horses.map(
      (horse) => this.calculateFinalMetrics(horse, logs)
    );

    // 순위 정렬
    this.currentRaceData.performance.sort(
      (a, b) => a.finalPosition - b.finalPosition
    );
  }

  /**
   * 🎯 즉석 분석 및 리포트
   */
  private async generateInstantReport(raceId: string): Promise<void> {
    if (!this.currentRaceData || !this.options.verbose) return;

    console.log("\n" + "=".repeat(60));
    console.log("🔥 INSTANT AI PERFORMANCE ANALYSIS 🔥");
    console.log("=".repeat(60));

    // 모든 분석을 내부에서 자동 처리
    this.displayPerformanceRanking();
    this.showAIRecommendations();
    this.displayEventSummary();

    if (this.options.saveReports) {
      await this.saveDetailedReports(raceId);
    }

    // 히스토리에 추가
    this.raceHistory.push({ ...this.currentRaceData });

    console.log("=".repeat(60));
    console.log("✨ Instant analysis completed! ✨");
    console.log("=".repeat(60));
  }

  /**
   * 성능 순위 표시
   */
  private displayPerformanceRanking(): void {
    if (!this.currentRaceData) return;

    console.log("\n🏆 Final Race Results:");

    // 완주한 말들을 먼저 완주 순서대로, 미완주 말들은 거리순으로 정렬
    const finishedHorses = this.currentRaceData.performance.filter(
      (m) => m.finished
    );
    const unfinishedHorses = this.currentRaceData.performance.filter(
      (m) => !m.finished
    );

    // 완주한 말들은 완주 시간 순으로 정렬
    finishedHorses.sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0));
    // 미완주 말들은 거리 순으로 정렬
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

  /**
   * AI 개선 제안
   */
  private showAIRecommendations(): void {
    if (!this.currentRaceData) return;

    console.log("\n🧠 AI Optimization Recommendations:");

    const recommendations: string[] = [];

    // 🚨 완주 분석 (최우선)
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

    // 충돌 회피 분석
    const totalCollisions = this.currentRaceData.events.filter(
      (e) => e.eventType === "collision_avoidance"
    ).length;
    if (totalCollisions > 10) {
      recommendations.push(
        "충돌 회피 전략 개선 필요 - 너무 많은 충돌 상황 발생"
      );
    }

    // 추월 성공률 분석
    const overtakeAttempts = this.currentRaceData.events.filter(
      (e) => e.eventType === "overtake_attempt"
    ).length;
    const overtakeSuccesses = this.currentRaceData.events.filter(
      (e) => e.eventType === "overtake_success"
    ).length;
    if (overtakeAttempts > 0 && overtakeSuccesses / overtakeAttempts < 0.3) {
      recommendations.push("추월 성공률이 낮음 - 추월 전략 재검토 필요");
    }

    // 스태미나 효율성 분석
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

  /**
   * 이벤트 요약 표시
   */
  private displayEventSummary(): void {
    if (!this.currentRaceData) return;

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
      `   � Guardrail Violations: ${eventCounts.guardrail_violation}`
    );
    console.log(`   �📍 Segment Updates: ${eventCounts.segment_progress}`);
  }

  // 유틸리티 메서드들
  private recordEvent(
    turn: number,
    horseId: string,
    eventType: RaceEvent["eventType"],
    description: string,
    position: { x: number; y: number }
  ): void {
    if (!this.currentRaceData) return;

    this.currentRaceData.events.push({
      turn,
      horseId,
      eventType,
      description,
      position,
    });
  }

  private updatePerformanceMetrics(horse: RaceHorse, turn: number): void {
    // 성능 메트릭 업데이트 로직
    // 실제 구현에서는 더 상세한 계산이 필요
  }

  private getCurrentMetrics(horse: RaceHorse): PerformanceMetrics {
    // 현재 성능 메트릭 반환
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
    };
  }

  private calculateFinalMetrics(
    horse: RaceHorse,
    logs: RaceLog[]
  ): PerformanceMetrics {
    // 최종 성능 메트릭 계산
    const horseEvents =
      this.currentRaceData?.events.filter(
        (e) => e.horseId === horse.horseId.toString()
      ) || [];

    // 방향 왜곡 이벤트 분석
    const directionDistortionEvents = horseEvents.filter(
      (e) => e.eventType === "direction_distortion"
    );

    // 평균 방향 왜곡률 계산
    let avgDirectionDistortion = 0;
    if (directionDistortionEvents.length > 0) {
      const totalDistortion = directionDistortionEvents.reduce((sum, event) => {
        const match = event.description.match(/(\d+\.?\d*)°/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);
      avgDirectionDistortion =
        totalDistortion / directionDistortionEvents.length;
    }

    return {
      horseId: horse.horseId.toString(),
      horseName: horse.name,
      averageSpeed: horse.speed, // 실제로는 평균 계산 필요
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
      finalPosition: 0, // 실제 순위 계산 필요
      raceDistance: horse.raceDistance,
      finished: horse.finished,
      finishTime: this.finishTimes.get(horse.horseId.toString()),
      directionDistortions: directionDistortionEvents.length,
      avgDirectionDistortion: avgDirectionDistortion,
    };
  }

  private compareRacePerformances(): void {
    // 다중 레이스 성능 비교
    console.log(`📊 Comparing ${this.raceHistory.length} races...`);
  }

  private identifyPatterns(): void {
    // 패턴 식별
    console.log("🔍 Identifying performance patterns...");
  }

  private generateImprovementSuggestions(): void {
    // 개선 제안 생성
    console.log("💡 Generating improvement suggestions...");
  }

  private cleanupOldFiles(): void {
    try {
      const dir = path.resolve(process.cwd());
      const files = fs.readdirSync(dir);

      // 성능 파일들 찾기 (JSON)
      const performanceFiles = files
        .filter((f) => f.startsWith("performance-race_") && f.endsWith(".json"))
        .map((f) => ({
          name: f,
          path: path.join(dir, f),
          timestamp: fs.statSync(path.join(dir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬

      // CSV 파일들 찾기
      const csvFiles = files
        .filter(
          (f) => f.startsWith("detailed_analysis_race_") && f.endsWith(".csv")
        )
        .map((f) => ({
          name: f,
          path: path.join(dir, f),
          timestamp: fs.statSync(path.join(dir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬

      // 최신 2개 파일을 제외하고 나머지 삭제
      const deleteFiles = (fileList: any[]) => {
        if (fileList.length > 2) {
          const filesToDelete = fileList.slice(2); // 처음 2개 (최신) 제외
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
    if (!this.currentRaceData) return;

    try {
      // 순환 참조 문제를 해결하기 위해 필요한 데이터만 추출
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

      // JSON 리포트 저장
      const jsonPath = path.resolve(
        process.cwd(),
        `performance-${raceId}.json`
      );
      await fs.promises.writeFile(jsonPath, JSON.stringify(saveData, null, 2));

      // CSV 리포트 저장
      const csvPath = path.resolve(
        process.cwd(),
        `detailed_analysis_${raceId}.csv`
      );
      const csvContent = this.generateCSVContent();
      await fs.promises.writeFile(csvPath, csvContent);

      console.log("\n💾 Detailed reports saved:");
      console.log(`   📄 performance-${raceId}.json`);
      console.log(`   📊 detailed_analysis_${raceId}.csv`);

      // 이전 파일들 정리 (최신 2개만 유지)
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
    if (!this.currentRaceData) return "";

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
    ];

    const rows = this.currentRaceData.performance.map((metrics) => [
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
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }
}
