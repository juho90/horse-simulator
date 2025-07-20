import * as fs from "fs";
import { DistanceSource } from "./directionalDistance";
import { Horse } from "./horse";
import { NearbyHorse } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { HorseTurnState, RaceLog } from "./raceLog";
import { Distance } from "./raceMath";
import { TRACK_WIDTH } from "./raceSimulator";
import { RaceTrack } from "./raceTrack";

enum ThreatLevel {
  NONE = "none",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

interface RaceEvent {
  turn: number;
  horseId: string;
  description: string;
  position: { x: number; y: number };
  speed: number;
  threatLevel: ThreatLevel;
}

enum DirectionType {
  FRONT = "front",
  LEFT = "left",
  RIGHT = "right",
  FRONT_LEFT = "frontLeft",
  FRONT_RIGHT = "frontRight",
}

export class PerformanceMonitor {
  private collisionAvoidanceEvents: RaceEvent[] = [];
  private modeChangeEvents: RaceEvent[] = [];
  private finishEvents: RaceEvent[] = [];
  private offTrackEvents: RaceEvent[] = [];
  private segmentProgressEvents: RaceEvent[] = [];
  private guardrailViolationEvents: RaceEvent[] = [];
  private directionDistortionEvents: RaceEvent[] = [];
  private situationAnalysisEvents: RaceEvent[] = [];

  constructor() {}

  async runRaceWithAnalysis(
    track: RaceTrack,
    horses: Horse[]
  ): Promise<RaceLog[]> {
    this.collisionAvoidanceEvents = [];
    this.modeChangeEvents = [];
    this.finishEvents = [];
    this.offTrackEvents = [];
    this.segmentProgressEvents = [];
    this.guardrailViolationEvents = [];
    this.directionDistortionEvents = [];
    this.situationAnalysisEvents = [];

    const logs = await this.runSimulationWithMonitoring(track, horses);
    const report = this.generateSituationReport();
    await this.saveSituationReport(report);
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
              this.modeChangeEvents.push({
                turn,
                horseId: horse.horseId.toString(),
                description: `Mode changed from ${prevMode} to ${currentMode}`,
                position: { x: horse.x, y: horse.y },
                speed: horse.speed,
                threatLevel: ThreatLevel.NONE,
              });
            }
            this.detectEvents(horse, turn, track);
            if (horse.finished) {
              this.finishEvents.push({
                turn,
                horseId: horse.horseId.toString(),
                description: `Finished the race at turn ${turn}`,
                position: { x: horse.x, y: horse.y },
                speed: horse.speed,
                threatLevel: ThreatLevel.NONE,
              });
            }
          }
          horseStates[index] = {
            id: horse.horseId,
            name: horse.name,
            x: horse.x,
            y: horse.y,
            speed: horse.speed,
            accel: horse.accel,
            stamina: horse.stamina,
            dist: horse.raceDistance,
            closestHitPoints: horse.raceEnv.closestRaycasts?.map(
              (r) => r.hitPoint
            ),
            farthestHitPoint: horse.raceEnv.farthestRaycast?.hitPoint,
          };
        }
      } catch (error) {
        raceHorses.forEach((h) => (h.finished = true));
      }
      logs.push({ turn, horseStates });
      turn++;
    }
    return logs;
  }

  private detectEvents(horse: RaceHorse, turn: number, track: RaceTrack): void {
    if (turn > 0) {
      this.segmentProgressEvents.push({
        turn,
        horseId: horse.horseId.toString(),
        description: `Segment: ${
          horse.segmentIndex
        }, Distance: ${horse.raceDistance.toFixed(
          1
        )}m, Position: (${horse.x.toFixed(1)}, ${horse.y.toFixed(1)})`,
        position: { x: horse.x, y: horse.y },
        speed: horse.speed,
        threatLevel: ThreatLevel.NONE,
      });
    }
    this.analyzeCollisions(horse, horse.raceEnv.nearbyHorses, turn);
    this.analyzeSituationalDecision(horse, horse.raceEnv.nearbyHorses, turn);
    this.detectGuardrailViolations(horse, track, turn);
    this.detectDirectionDistortion(horse, track, turn);
  }

  private analyzeCollisions(
    horse: RaceHorse,
    nearbyHorses: NearbyHorse,
    turn: number
  ): void {
    const nearbyHorseArray = [
      { direction: DirectionType.FRONT, horse: nearbyHorses.front },
      { direction: DirectionType.LEFT, horse: nearbyHorses.left },
      { direction: DirectionType.RIGHT, horse: nearbyHorses.right },
    ];
    let criticalDistance = 0;
    let criticalCount = 0;
    const highDirections: DirectionType[] = [];
    let highDistance = 0;
    let highCount = 0;
    let nearbyDistance = 0;
    let nearbyCount = 0;
    for (const nearbyHorse of nearbyHorseArray) {
      if (!nearbyHorse.horse) {
        continue;
      }
      const distance = Distance(horse, nearbyHorse.horse);
      const threatLevel = this.calculateDistanceThreatLevel(
        distance,
        nearbyHorse.direction
      );
      if (threatLevel === ThreatLevel.CRITICAL) {
        criticalDistance += distance;
        criticalCount++;
      }
      if (threatLevel === ThreatLevel.HIGH) {
        highDirections.push(nearbyHorse.direction);
        highDistance += distance;
        highCount++;
      }
      nearbyDistance += distance;
      nearbyCount++;
    }
    if (criticalCount > 0) {
      const avgCriticalDistance = (criticalDistance / criticalCount).toFixed(1);
      this.collisionAvoidanceEvents.push({
        turn,
        horseId: horse.horseId.toString(),
        description: `🚨 CRITICAL COLLISION RISK: ${criticalCount} horses within ${avgCriticalDistance}m - Emergency evasion required`,
        position: { x: horse.x, y: horse.y },
        speed: horse.speed,
        threatLevel: ThreatLevel.CRITICAL,
      });
    }
    if (highCount > 0) {
      const directionStr = highDirections.join(", ");
      this.collisionAvoidanceEvents.push({
        turn,
        horseId: horse.horseId.toString(),
        description: `⚠️ HIGH COLLISION RISK: ${highCount} horses threatening from [${directionStr}] - Caution advised`,
        position: { x: horse.x, y: horse.y },
        speed: horse.speed,
        threatLevel: ThreatLevel.HIGH,
      });
    }
    if (nearbyCount >= 3) {
      const avgNearbyDistance = (nearbyDistance / nearbyCount).toFixed(1);
      this.collisionAvoidanceEvents.push({
        turn,
        horseId: horse.horseId.toString(),
        description: `🚦 TRAFFIC CONGESTION: ${nearbyCount} horses clustered (avg: ${avgNearbyDistance}m)`,
        position: { x: horse.x, y: horse.y },
        speed: horse.speed,
        threatLevel: ThreatLevel.MEDIUM,
      });
    }
  }

  private analyzeSituationalDecision(
    horse: RaceHorse,
    nearbyHorses: NearbyHorse,
    turn: number
  ): void {
    const nearbyHorseArray = [
      { direction: DirectionType.FRONT, horse: nearbyHorses.front },
      { direction: DirectionType.LEFT, horse: nearbyHorses.left },
      { direction: DirectionType.RIGHT, horse: nearbyHorses.right },
    ];
    const nearbyHorseDistances: {
      direction: DirectionType;
      name: string;
      distance: number;
    }[] = [];
    const nearbyHorseDirections: DirectionType[] = [];
    for (const nearbyHorse of nearbyHorseArray) {
      if (!nearbyHorse.horse) {
        continue;
      }
      const distance = Distance(horse, nearbyHorse.horse);
      nearbyHorseDistances.push({
        direction: nearbyHorse.direction,
        name: nearbyHorse.horse.name,
        distance: distance,
      });
      nearbyHorseDirections.push(nearbyHorse.direction);
    }
    const nearbyWallDistances: {
      direction: DirectionType;
      distance: number;
    }[] = [];
    if (horse.raceAnalysis.dirDistanceWithSource) {
      const dirDistWithSource = horse.raceAnalysis.dirDistanceWithSource;
      const dirDists = [
        { direction: DirectionType.FRONT, value: dirDistWithSource.front },
        { direction: DirectionType.LEFT, value: dirDistWithSource.left },
        { direction: DirectionType.RIGHT, value: dirDistWithSource.right },
      ];
      for (const dirDist of dirDists) {
        if (dirDist.value.source !== DistanceSource.Wall) {
          continue;
        }
        nearbyWallDistances.push({
          direction: dirDist.direction,
          distance: dirDist.value.distance,
        });
      }
    }
    const threatLevel = this.analyzeThreatLevel(
      nearbyHorseDistances,
      nearbyWallDistances
    );
    const decisionMade = this.analyzeHorseDecision(
      horse,
      nearbyHorseDirections
    );
    const situationDescription = this.generateSituationDescription(
      horse,
      nearbyHorseDistances,
      nearbyWallDistances,
      threatLevel,
      decisionMade
    );
    this.situationAnalysisEvents.push({
      turn,
      horseId: horse.name,
      description: situationDescription,
      position: { x: horse.x, y: horse.y },
      speed: horse.speed,
      threatLevel: threatLevel,
    });
  }

  private analyzeThreatLevel(
    nearbyHorseDistances: {
      direction: DirectionType;
      distance: number;
    }[],
    nearbyWallDistances: { direction: DirectionType; distance: number }[]
  ): ThreatLevel {
    let criticalCount = 0;
    let highCount = 0;
    for (const nearbyHorseDistance of nearbyHorseDistances) {
      const threatLevel = this.calculateDistanceThreatLevel(
        nearbyHorseDistance.distance,
        nearbyHorseDistance.direction
      );
      if (threatLevel === ThreatLevel.CRITICAL) {
        criticalCount++;
        break;
      }
      if (threatLevel === ThreatLevel.HIGH) {
        highCount++;
      }
    }
    for (const nearbyWallDistance of nearbyWallDistances) {
      const threatLevel = this.calculateDistanceThreatLevel(
        nearbyWallDistance.distance,
        nearbyWallDistance.direction
      );
      if (threatLevel === ThreatLevel.CRITICAL) {
        criticalCount++;
        break;
      }
      if (threatLevel === ThreatLevel.HIGH) {
        highCount++;
      }
    }
    if (criticalCount > 0) {
      return ThreatLevel.CRITICAL;
    }
    if (highCount > 0) {
      return ThreatLevel.HIGH;
    }
    if (nearbyHorseDistances.length > 0 || nearbyWallDistances.length > 0) {
      return ThreatLevel.MEDIUM;
    }
    return ThreatLevel.NONE;
  }

  private analyzeHorseDecision(
    horse: RaceHorse,
    nearbyHorseDirections: DirectionType[]
  ): string {
    if (horse.speed < 3) {
      return "급감속";
    }
    if (horse.speed < 8) {
      return "감속";
    }
    if (horse.speed > 15) {
      return "가속";
    }
    let leftCount = 0;
    let rightCount = 0;
    for (const direction of nearbyHorseDirections) {
      if (direction === DirectionType.LEFT) {
        leftCount++;
      } else if (direction === DirectionType.RIGHT) {
        rightCount++;
      }
    }
    if (leftCount > rightCount) {
      return "우회전 시도";
    }
    if (rightCount > leftCount) {
      return "좌회전 시도";
    }
    return "직진 유지";
  }

  private analyzeDecisionOutcome(speed: number): string {
    if (speed < 2) {
      return "정지/교착상태";
    }
    if (speed < 5) {
      return "저속 진행";
    }
    if (speed > 12) {
      return "원활한 진행";
    }
    return "보통 진행";
  }

  private generateSituationDescription(
    horse: RaceHorse,
    nearbyHorseDistances: {
      direction: DirectionType;
      name: string;
      distance: number;
    }[],
    nearbyWallDistances: {
      direction: DirectionType;
      distance: number;
    }[],
    threatLevel: string,
    decisionMade: string
  ): string {
    let story = "";
    const threatOpenings = {
      critical: "🚨 위급상황!",
      high: "⚠️ 주의상황:",
      medium: "📊 일반상황:",
      none: "✅ 안전상황:",
    };
    story +=
      threatOpenings[threatLevel as keyof typeof threatOpenings] || "상황:";
    const nearbyDescriptions: string[] = [];
    for (const nearbyHorse of nearbyHorseDistances) {
      let proximityStr = "";
      if (nearbyHorse.distance < 5) {
        proximityStr = "바로";
      } else if (nearbyHorse.distance < 10) {
        proximityStr = "아주 가까운";
      } else if (nearbyHorse.distance < 20) {
        proximityStr = "가까운";
      } else {
        proximityStr = "멀리 있는";
      }
      let directionStr = "";
      if (nearbyHorse.direction === DirectionType.FRONT) {
        directionStr = "앞에";
      } else if (nearbyHorse.direction === DirectionType.LEFT) {
        directionStr = "왼쪽에";
      } else if (nearbyHorse.direction === DirectionType.RIGHT) {
        directionStr = "오른쪽에";
      } else {
        directionStr = "근처에";
      }
      const distanceStr = nearbyHorse.distance.toFixed(1);
      nearbyDescriptions.push(
        `${proximityStr} ${directionStr} ${nearbyHorse.name}(${distanceStr}m)`
      );
    }
    if (nearbyDescriptions.length > 0) {
      story += ` ${nearbyDescriptions.join(", ")}가 있어서`;
    } else {
      story += " 주변이 비어있어서";
    }
    if (nearbyWallDistances.length > 0) {
      let minWall = Infinity;
      let minDirection = DirectionType.FRONT;
      for (const wall of nearbyWallDistances) {
        if (wall.distance < minWall) {
          minWall = wall.distance;
          minDirection = wall.direction;
        }
      }
      if (minWall < 30) {
        let directionStr = "";
        if (minDirection === DirectionType.FRONT) {
          directionStr = "앞에";
        } else if (minDirection === DirectionType.LEFT) {
          directionStr = "왼쪽에";
        } else if (minDirection === DirectionType.RIGHT) {
          directionStr = "오른쪽에";
        } else {
          directionStr = "근처에";
        }
        story += ` 벽도 ${directionStr} ${minWall.toFixed(0)}m로 가까워서`;
      }
    }
    const decisionMap: { [key: string]: string } = {
      감속: "속도를 줄였다",
      가속: "속도를 높였다",
      급감속: "급하게 멈췄다",
      "좌회전 시도": "왼쪽으로 피하려 했다",
      "우회전 시도": "오른쪽으로 피하려 했다",
      "직진 유지": "그대로 직진했다",
    };
    const action = decisionMap[decisionMade] || decisionMade;
    story += ` ${action}.`;
    story += ` (현재속도: ${horse.speed.toFixed(1)}km/h)`;
    return story;
  }

  private calculateDistanceThreatLevel(
    distance: number,
    direction: DirectionType
  ): ThreatLevel {
    const directionMultiplier = {
      front: 1.5,
      left: 1.2,
      right: 1.2,
      unknown: 1.0,
    };
    const multiplier =
      directionMultiplier[direction as keyof typeof directionMultiplier] || 1.0;
    const adjustedDistance = distance / multiplier;
    if (adjustedDistance < 10) {
      return ThreatLevel.CRITICAL;
    }
    if (adjustedDistance < 20) {
      return ThreatLevel.HIGH;
    }
    if (adjustedDistance < 35) {
      return ThreatLevel.MEDIUM;
    }
    return ThreatLevel.LOW;
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
        this.guardrailViolationEvents.push({
          turn,
          horseId: horse.horseId.toString(),
          description: `🚧 ${violationType?.toUpperCase()} guardrail violation! Distance: ${violationDistance.toFixed(
            1
          )}m from ${violationType} boundary (Segment: ${horse.segmentIndex})`,
          position: { x: horse.x, y: horse.y },
          speed: horse.speed,
          threatLevel: ThreatLevel.HIGH,
        });
        if (violationDistance > 5) {
          this.offTrackEvents.push({
            turn,
            horseId: horse.horseId.toString(),
            description: `⚠️ Severely off track! ${violationDistance.toFixed(
              1
            )}m from ${violationType} guardrail`,
            position: { x: horse.x, y: horse.y },
            speed: horse.speed,
            threatLevel: ThreatLevel.CRITICAL,
          });
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
        this.directionDistortionEvents.push({
          turn,
          horseId: horse.horseId.toString(),
          description: `🔄 Direction distortion: ${distortionAngle.toFixed(
            1
          )}° (${distortionPercent.toFixed(1)}%) from optimal path (Segment: ${
            horse.segmentIndex
          })`,
          position: { x: horse.x, y: horse.y },
          speed: horse.speed,
          threatLevel: ThreatLevel.MEDIUM,
        });
      }
    } catch (error) {}
  }

  generateSituationReport(): string {
    let report = "";
    report += "🎯 SITUATIONAL DECISION ANALYSIS\n";
    report += "-".repeat(50) + "\n";
    if (this.situationAnalysisEvents.length === 0) {
      return "No situational analysis events found.";
    }
    report += `Total Situations Analyzed: ${this.situationAnalysisEvents.length}\n\n`;
    const horseNames = new Set(
      this.situationAnalysisEvents.map((e) => e.horseId)
    );
    for (const horseName of horseNames) {
      const horseSituations = this.situationAnalysisEvents
        .filter((e) => e.horseId === horseName)
        .slice(0, 100);
      if (horseSituations.length > 0) {
        report += `\n🏇 ${horseName}의 실제 상황들:\n`;
        report += "-".repeat(40) + "\n";
        let index = 0;
        for (const situation of horseSituations) {
          report += `${index + 1}. 📍 Turn ${situation.turn} - ${
            situation.threatLevel
          }\n`;
          report += `   ${situation.description}\n`;
          const outcome = this.analyzeDecisionOutcome(situation.speed);
          let outcomeEmoji = "";
          if (outcome.includes("원활")) {
            outcomeEmoji = "🚀";
          } else if (outcome.includes("저속")) {
            outcomeEmoji = "🐌";
          } else if (outcome.includes("교착")) {
            outcomeEmoji = "🛑";
          } else {
            outcomeEmoji = "📊";
          }
          report += `   ${outcomeEmoji} 결과: ${outcome}\n`;
          report += "\n";
          index++;
        }
      }
    }
    let criticalSituations = 0;
    let highSituations = 0;
    let mediumSituations = 0;
    for (const event of this.situationAnalysisEvents) {
      if (event.threatLevel === ThreatLevel.CRITICAL) {
        criticalSituations++;
      } else if (event.threatLevel === ThreatLevel.HIGH) {
        highSituations++;
      } else if (event.threatLevel === ThreatLevel.MEDIUM) {
        mediumSituations++;
      }
    }
    report += `\n📊 위험도별 상황 통계:\n`;
    report += `  🚨 Critical Situations: ${criticalSituations}\n`;
    report += `  ⚠️ High Risk Situations: ${highSituations}\n`;
    report += `  📊 Medium Risk Situations: ${mediumSituations}\n`;
    return report;
  }

  async saveSituationReport(report: string): Promise<void> {
    const filename = "race-statistics.txt";
    try {
      await fs.promises.writeFile(filename, report, "utf-8");
      console.log(`🎯 상황 분석 리포트가 ${filename}에 저장되었습니다.`);
    } catch (error) {
      console.error("리포트 저장 실패:", error);
    }
  }
}
