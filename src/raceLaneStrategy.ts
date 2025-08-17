import { RaceHorse } from "./raceHorse";
import { Distance } from "./raceMath";
import { RaceSegmentNode, SegmentType } from "./raceSegment";
import { RaceTrack } from "./raceTrack";
import { RaceTracker } from "./raceTracker";

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
  private raceTrack: RaceTrack;
  private raceTracker: RaceTracker;

  constructor(raceTrack: RaceTrack, raceTracker: RaceTracker) {
    this.raceTrack = raceTrack;
    this.raceTracker = raceTracker;
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
      if (horse.getHorseId() === other.getHorseId()) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.getHorseSpeed()) {
        const safeLane = this.findSafestLane(horse, others);
        return { risk: true, safeLane };
      }
    }
    return { risk: false, safeLane: horse.raceLane };
  }

  private findSafestLane(horse: RaceHorse, others: RaceHorse[]): number {
    const maxLanes = this.raceTracker.getLaneLength();
    const candidates = [];

    for (let offset = 1; offset <= 3; offset++) {
      const leftLane = horse.raceLane - offset;
      const rightLane = horse.raceLane + offset;

      if (leftLane >= 0) candidates.push(leftLane);
      if (rightLane < maxLanes) candidates.push(rightLane);
    }

    for (const lane of candidates) {
      if (this.isLaneClearForMove(horse, lane, others)) {
        return lane;
      }
    }

    return horse.raceLane;
  }

  private checkPressureLevel(horse: RaceHorse, others: RaceHorse[]) {
    let nearbyCount = 0;
    for (const other of others) {
      if (horse.getHorseId() === other.getHorseId()) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.getHorseSpeed()) {
        nearbyCount++;
      }
    }
    if (nearbyCount >= 3) {
      const maxLanes = this.raceTracker.getLaneLength();
      const reliefLane =
        horse.raceLane < maxLanes / 2 ? horse.raceLane + 2 : horse.raceLane - 2;
      return {
        high: true,
        reliefLane: Math.max(0, Math.min(maxLanes - 1, reliefLane)),
      };
    }
    return { high: false, reliefLane: horse.raceLane };
  }

  private checkCornerStrategy(
    node: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ) {
    const nextSegmentIndex =
      (node.segmentIndex + 1) % this.raceTrack.getSegmentsLength();
    const nextSegment = this.raceTrack.getSegment(nextSegmentIndex);
    const maxLanes = this.raceTracker.getLaneLength();
    const midLane = Math.floor(maxLanes / 2);

    if (nextSegment.type === SegmentType.CORNER && horse.raceLane > midLane) {
      const targetLane = Math.max(0, horse.raceLane - 2);
      return { shouldMove: true, targetLane };
    }
    return { shouldMove: false, targetLane: horse.raceLane };
  }

  private checkOvertakeChance(horse: RaceHorse, others: RaceHorse[]) {
    const overtakeDistance = horse.getHorseSpeed() * 2.0;
    const maxLanes = this.raceTracker.getLaneLength();
    for (const other of others) {
      if (horse.getHorseId() === other.getHorseId()) {
        continue;
      }
      if (other.raceLane !== horse.raceLane) {
        continue;
      }
      const distance = Distance(horse, other);
      if (
        distance < overtakeDistance &&
        horse.getHorseSpeed() > other.getHorseSpeed() * 1.1
      ) {
        const midLane = Math.floor(maxLanes / 2);
        const targetLane =
          horse.raceLane > midLane ? horse.raceLane - 1 : horse.raceLane + 1;
        return {
          possible: true,
          targetLane: Math.max(0, Math.min(maxLanes - 1, targetLane)),
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
      (currentNode.segmentIndex + 1) % this.raceTrack.getSegmentsLength();
    const nextSegment = this.raceTrack.getSegment(nextSegmentIndex);
    let bestLane = horse.raceLane;
    let shortestDistance = Infinity;
    let foundBetter = false;
    for (let lane = 0; lane < this.raceTracker.getLaneLength(); lane++) {
      if (Math.abs(lane - horse.raceLane) > 2) {
        continue;
      }
      if (!this.isLaneClearForMove(horse, lane, others)) {
        continue;
      }
      const nextLaneDistance = this.calculateDistanceToNextSegment(
        horse,
        lane,
        nextSegmentIndex
      );
      const laneChangeCost =
        Math.abs(lane - horse.raceLane) * horse.getHorseSpeed() * 0.1;
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
    for (let i = 0; i < this.raceTrack.getSegmentsLength(); i++) {
      const segment = this.raceTrack.getSegment(i);
      const segmentProgress = horse.progress - segment.getCumulativeProgress();
      if (
        segmentProgress >= 0 &&
        segmentProgress <= segment.length / this.raceTrack.getTrackLength()
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
    nextSegmentIndex: number
  ): number {
    try {
      const nextSegmentNodes =
        this.raceTracker.getSegmentNodes(nextSegmentIndex);
      if (
        nextSegmentNodes &&
        nextSegmentNodes[targetLane] &&
        nextSegmentNodes[targetLane].length > 0
      ) {
        const firstNode = nextSegmentNodes[targetLane][0];
        return Distance(horse, firstNode);
      }
    } catch (error) {}
    const maxLanes = this.raceTracker.getLaneLength();
    const laneOffset = (targetLane - Math.floor(maxLanes / 2)) * 15;
    const targetX = horse.x + laneOffset;
    const targetY = horse.y + 50;
    return Distance(horse, { x: targetX, y: targetY });
  }

  private isLaneClearForMove(
    horse: RaceHorse,
    targetLane: number,
    others: RaceHorse[]
  ): boolean {
    for (const other of others) {
      if (horse.getHorseId() === other.getHorseId()) {
        continue;
      }
      if (other.raceLane !== targetLane) {
        continue;
      }
      const distance = Distance(horse, other);
      if (distance < horse.getHorseSpeed()) {
        return false;
      }
    }
    return true;
  }
}
