import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceLaneStrategy } from "./raceLaneStrategy";
import { Distance, DistanceArc, Lerp, LerpNumber, Vector2D } from "./raceMath";
import { RaceSegmentNode, SegmentType, TRACK_WIDTH } from "./raceSegment";
import { RaceTrack } from "./raceTrack";
import { findNearestIndexInPath, RaceTrackNode } from "./raceTrackNode";

export interface NextPos {
  startNode: RaceSegmentNode;
  endNode: RaceSegmentNode | null;
  pos: Vector2D;
  progress: number;
  moveDistance: number;
}

export class RaceTracker {
  private raceTrack: RaceTrack;
  private trackPadding: number;
  private nodeResolution: number;
  private raceLaneStrategy: RaceLaneStrategy;
  private raceTrackNode: RaceTrackNode;

  constructor(
    raceTrack: RaceTrack,
    trackPadding: number = 10,
    nodeResolution: number = 15
  ) {
    this.raceTrack = raceTrack;
    this.trackPadding = trackPadding;
    this.nodeResolution = nodeResolution;
    this.raceLaneStrategy = new RaceLaneStrategy(raceTrack);
    this.raceTrackNode = new RaceTrackNode(
      raceTrack,
      TRACK_WIDTH,
      nodeResolution,
      trackPadding
    );
  }

  getNodes(): RaceSegmentNode[][][] {
    return this.raceTrackNode.getNodes();
  }

  getGateNodes(): RaceSegmentNode[] {
    return this.raceTrackNode.getGateNodes();
  }

  findNextPosInPath(
    pos: Vector2D,
    progress: number,
    remaining: number,
    path: RaceSegmentNode[]
  ): NextPos | null {
    let startNode: RaceSegmentNode = path[0];
    let endNode: RaceSegmentNode | null = null;
    let newPos = pos;
    let newProgress = progress;
    let moveDistance = 0;
    if (path.length < 2) {
      return null;
    }
    let nextIndex = findNearestIndexInPath(path, progress);
    if (nextIndex === null) {
      return null;
    }
    startNode = path[nextIndex - 1];
    endNode = path[nextIndex];
    if (!startNode || !endNode) {
      throw new Error("Start or end node is null");
    }
    const startProgress = startNode.progress;
    let endProgress = endNode.progress;
    if (endProgress < startProgress) {
      endProgress += 1;
    }
    const segment = this.raceTrack.getSegment(startNode.segmentIndex);
    if (segment.type === SegmentType.LINE) {
      const nodeDistance = Distance(startNode, endNode);
      const currDistance = Distance(startNode, pos);
      const ratio = Math.min(1, (currDistance + remaining) / nodeDistance);
      newPos = Lerp(startNode, endNode, ratio);
      moveDistance = nodeDistance * ratio - currDistance;
      newProgress = LerpNumber(startProgress, endProgress, ratio);
    } else {
      const center = (segment as RaceCorner).center;
      const { arcDistance: currDistance } = DistanceArc(startNode, pos, center);
      const { radius, startAngle, angle, arcDistance } = DistanceArc(
        startNode,
        endNode,
        center
      );
      const ratio = Math.min(1, (currDistance + remaining) / arcDistance);
      const newAngle = startAngle + angle * ratio;
      newPos = {
        x: center.x + radius * Math.cos(newAngle),
        y: center.y + radius * Math.sin(newAngle),
      };
      moveDistance = arcDistance * ratio - currDistance;
      newProgress = LerpNumber(startProgress, endProgress, ratio);
    }
    return {
      startNode,
      endNode,
      pos: newPos,
      progress: newProgress,
      moveDistance,
    };
  }

  findPath(horse: RaceHorse, others: RaceHorse[]): RaceSegmentNode[] | null {
    const prevNode = this.raceTrackNode.findPrevNode(
      horse.raceLane,
      horse.progress
    );
    if (!prevNode) {
      return null;
    }
    return this.raceAStar(prevNode, horse, others);
  }

  private raceAStar(
    startNode: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[],
    pathLength = 15
  ): RaceSegmentNode[] | null {
    const path: RaceSegmentNode[] = [startNode];
    let currentNode = startNode;
    for (let pIndex = 0; pIndex < pathLength; pIndex++) {
      const node = this.findNextNode(currentNode, horse, others);
      if (!node) {
        break;
      }
      path.push(node);
      currentNode = node;
    }
    return path;
  }

  private findNextNode(
    startNode: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ): RaceSegmentNode | null {
    const result = this.raceLaneStrategy.decideLaneChange(
      startNode,
      horse,
      others
    );
    return this.raceTrackNode.findPostNode(
      result.targetLane,
      startNode.progress
    );
  }
}
