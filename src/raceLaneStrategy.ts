import { RaceHorse } from "./raceHorse";
import { Distance } from "./raceMath";
import { RaceSegmentNode, SegmentType } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export enum LaneChangeReason {
  SAFETY_COLLISION_AVOIDANCE = "collision_avoidance",
  SAFETY_PRESSURE_RELIEF = "pressure_relief",
  SAFETY_LANE_PROTECTION = "lane_protection",
  ATTACK_DISTANCE_REDUCTION = "distance_reduction",
  ATTACK_TRAFFIC_OVERTAKE = "traffic_overtake",
  ATTACK_POSITION_CONTROL = "position_control",
  ATTACK_SPEED_UTILIZATION = "speed_utilization",
}

export interface LaneChangeDecision {
  shouldChange: boolean;
  targetLane: number;
  reason: LaneChangeReason;
  urgency: number;
}

export class RaceLaneStrategy {
  track: RaceTrack;
  constructor(track: RaceTrack) {
    this.track = track;
  }

  decideLaneChange(
    node: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ): LaneChangeDecision {
    const decisions: LaneChangeDecision[] = [];
    const safetyDecision = this.checkSafetyReasons(node, horse, others);
    if (safetyDecision.shouldChange) {
      decisions.push(safetyDecision);
    }
    const attackDecision = this.checkAttackReasons(node, horse, others);
    if (attackDecision.shouldChange) {
      decisions.push(attackDecision);
    }
    if (decisions.length === 0) {
      return {
        shouldChange: false,
        targetLane: horse.raceLane,
        reason: LaneChangeReason.SAFETY_COLLISION_AVOIDANCE,
        urgency: 0,
      };
    }
    decisions.sort((a, b) => b.urgency - a.urgency);
    return decisions[0];
  }

  private checkSafetyReasons(
    node: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ): LaneChangeDecision {
    const collisionRisk = this.checkCollisionRisk(horse, others);
    if (collisionRisk.risk) {
      return {
        shouldChange: true,
        targetLane: collisionRisk.safeLane,
        reason: LaneChangeReason.SAFETY_COLLISION_AVOIDANCE,
        urgency: 100,
      };
    }
    const pressureLevel = this.checkPressureLevel(horse, others);
    if (pressureLevel.high) {
      return {
        shouldChange: true,
        targetLane: pressureLevel.reliefLane,
        reason: LaneChangeReason.SAFETY_PRESSURE_RELIEF,
        urgency: 80,
      };
    }
    return {
      shouldChange: false,
      targetLane: horse.raceLane,
      reason: LaneChangeReason.SAFETY_COLLISION_AVOIDANCE,
      urgency: 0,
    };
  }

  private checkAttackReasons(
    node: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ): LaneChangeDecision {
    const cornerStrategy = this.checkCornerStrategy(node, horse, others);
    if (cornerStrategy.shouldMove) {
      return {
        shouldChange: true,
        targetLane: cornerStrategy.targetLane,
        reason: LaneChangeReason.ATTACK_DISTANCE_REDUCTION,
        urgency: 70,
      };
    }
    const overtakeChance = this.checkOvertakeChance(horse, others);
    if (overtakeChance.possible) {
      return {
        shouldChange: true,
        targetLane: overtakeChance.targetLane,
        reason: LaneChangeReason.ATTACK_TRAFFIC_OVERTAKE,
        urgency: 60,
      };
    }
    const basicInward = this.checkBasicInwardMove(horse, others);
    if (basicInward.beneficial) {
      return {
        shouldChange: true,
        targetLane: basicInward.targetLane,
        reason: LaneChangeReason.ATTACK_DISTANCE_REDUCTION,
        urgency: 30,
      };
    }
    return {
      shouldChange: false,
      targetLane: horse.raceLane,
      reason: LaneChangeReason.ATTACK_DISTANCE_REDUCTION,
      urgency: 0,
    };
  }

  private checkCollisionRisk(horse: RaceHorse, others: RaceHorse[]) {
    for (const other of others) {
      if (horse.horseId === other.horseId) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.speed) {
        const safeLane =
          horse.raceLane < 5 ? horse.raceLane + 1 : horse.raceLane - 1;
        return { risk: true, safeLane };
      }
    }
    return { risk: false, safeLane: horse.raceLane };
  }

  private checkPressureLevel(horse: RaceHorse, others: RaceHorse[]) {
    let nearbyCount = 0;
    for (const other of others) {
      if (horse.horseId === other.horseId) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.speed) {
        nearbyCount++;
      }
    }
    if (nearbyCount >= 3) {
      const reliefLane =
        horse.raceLane < 5 ? horse.raceLane + 2 : horse.raceLane - 2;
      return { high: true, reliefLane: Math.max(0, Math.min(9, reliefLane)) };
    }
    return { high: false, reliefLane: horse.raceLane };
  }

  private checkCornerStrategy(
    node: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ) {
    const nextSegmentIndex =
      (node.segmentIndex + 1) % this.track.segments.length;
    const nextSegment = this.track.segments[nextSegmentIndex];
    if (nextSegment.type === SegmentType.CORNER && horse.raceLane > 2) {
      const targetLane = Math.max(0, horse.raceLane - 2);
      return { shouldMove: true, targetLane };
    }
    return { shouldMove: false, targetLane: horse.raceLane };
  }

  private checkOvertakeChance(horse: RaceHorse, others: RaceHorse[]) {
    const overtakeDistance = horse.speed * 2.0;
    for (const other of others) {
      if (horse.horseId === other.horseId) {
        continue;
      }
      if (other.raceLane !== horse.raceLane) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < overtakeDistance && horse.speed > other.speed * 1.1) {
        const targetLane =
          horse.raceLane > 5 ? horse.raceLane - 1 : horse.raceLane + 1;
        return {
          possible: true,
          targetLane: Math.max(0, Math.min(9, targetLane)),
        };
      }
    }
    return { possible: false, targetLane: horse.raceLane };
  }

  private checkBasicInwardMove(horse: RaceHorse, others: RaceHorse[]) {
    const currentNode = this.getCurrentNode(horse);
    if (!currentNode) {
      return { beneficial: false, targetLane: horse.raceLane };
    }
    const nextSegmentIndex =
      (currentNode.segmentIndex + 1) % this.track.segments.length;
    const nextSegment = this.track.segments[nextSegmentIndex];
    let bestLane = horse.raceLane;
    let shortestDistance = Infinity;
    let foundBetter = false;
    for (let lane = 0; lane < 10; lane++) {
      if (Math.abs(lane - horse.raceLane) > 2) {
        continue;
      }
      if (!this.isLaneClearForMove(horse, lane, others)) {
        continue;
      }
      const nextLaneDistance = this.calculateDistanceToNextSegment(
        horse,
        lane,
        nextSegment
      );
      const laneChangeCost =
        Math.abs(lane - horse.raceLane) * horse.speed * 0.1;
      const totalCost = nextLaneDistance + laneChangeCost;
      if (totalCost < shortestDistance) {
        shortestDistance = totalCost;
        bestLane = lane;
        foundBetter = lane !== horse.raceLane;
      }
    }
    return {
      beneficial: foundBetter,
      targetLane: bestLane,
    };
  }

  private getCurrentNode(horse: RaceHorse): RaceSegmentNode | null {
    for (let i = 0; i < this.track.segments.length; i++) {
      const segment = this.track.segments[i];
      const segmentProgress = horse.progress - segment.getCumulativeProgress();
      if (
        segmentProgress >= 0 &&
        segmentProgress <= segment.length / this.track.trackLength
      ) {
        return {
          segmentIndex: i,
          progress: horse.progress,
          lane: horse.raceLane,
          x: horse.x,
          y: horse.y,
        };
      }
    }
    return null;
  }

  private calculateDistanceToNextSegment(
    horse: RaceHorse,
    targetLane: number,
    nextSegment: any
  ): number {
    const approxNextX = nextSegment.startPoint?.x || horse.x;
    const approxNextY = nextSegment.startPoint?.y || horse.y;
    const laneOffset = (targetLane - 5) * 15;
    const targetX = approxNextX + laneOffset;
    const targetY = approxNextY;
    return Distance(horse, { x: targetX, y: targetY });
  }

  private isLaneClearForMove(
    horse: RaceHorse,
    targetLane: number,
    others: RaceHorse[]
  ): boolean {
    for (const other of others) {
      if (horse.horseId === other.horseId) {
        continue;
      }
      if (other.raceLane !== targetLane) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.speed) {
        return false;
      }
    }
    return true;
  }
}
