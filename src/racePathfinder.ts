import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import {
  Cost,
  Distance,
  DistanceArc,
  EPSILON,
  Lerp,
  LerpNumber,
  Vector2D,
} from "./raceMath";
import { RaceSegmentNode, SegmentType, TRACK_WIDTH } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface NextPos {
  startNode: RaceSegmentNode;
  endNode: RaceSegmentNode | null;
  pos: Vector2D;
  progress: number;
  moveDistance: number;
}

export class RacePathfinder {
  track: RaceTrack;
  nodeResolution: number;
  trackPadding: number;
  nodes: RaceSegmentNode[][][];

  constructor(
    track: RaceTrack,
    nodeResolution: number = 15,
    trackPadding: number = 10
  ) {
    this.track = track;
    this.nodeResolution = nodeResolution;
    this.trackPadding = trackPadding;
    this.nodes = createNodes(track, TRACK_WIDTH, nodeResolution, trackPadding);
  }

  getGateNodes(): RaceSegmentNode[] {
    const gateNodes: RaceSegmentNode[] = [];
    const prIndex = 0;
    const prNodes = this.nodes[prIndex];
    for (const laNodes of prNodes) {
      const firstNode = laNodes[0];
      if (EPSILON < firstNode.progress) {
        throw new Error("First node progress should be zero");
      }
      gateNodes.push(firstNode);
    }
    return gateNodes;
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
    let nextIndex = findNearestIndexInPath(path, progress, true);
    if (nextIndex === null || path.length - 1 <= nextIndex) {
      return null;
    }
    startNode = path[nextIndex - 1];
    endNode = path[nextIndex];
    if (!startNode || !endNode) {
      let nextIndex = findNearestIndexInPath(path, progress, true);
      throw new Error("Start or end node is null");
    }
    const segment = this.track.getSegment(startNode.segmentIndex);
    if (segment.type === SegmentType.LINE) {
      const nodeDistance = Distance(startNode, endNode);
      const currDistance = Distance(startNode, pos);
      const ratio = Math.min(1, (currDistance + remaining) / nodeDistance);
      newPos = Lerp(startNode, endNode, ratio);
      moveDistance = nodeDistance * ratio - currDistance;
      const addProgress = LerpNumber(
        startNode.progress,
        endNode.progress,
        ratio
      );
      newProgress = segment.getCumulativeProgress() + addProgress;
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
      const addProgress = LerpNumber(
        startNode.progress,
        endNode.progress,
        ratio
      );
      newProgress = segment.getCumulativeProgress() + addProgress;
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
    const startNode = this.findStartNode(horse);
    if (!startNode) {
      return null;
    }
    return this.raceAStar(startNode, horse, others);
  }

  findStartNode(horse: RaceHorse): RaceSegmentNode | null {
    let startNode: RaceSegmentNode | null = null;
    let minCost = Infinity;
    const nodeSections = findNodeSections(horse.progress, this.nodes.length);
    for (const prIndex of nodeSections) {
      const prNodes = this.nodes[prIndex];
      const laNodes = prNodes[horse.raceLane];
      const firstIndex = findNearestIndexInPath(laNodes, horse.progress, false);
      if (firstIndex === null) {
        continue;
      }
      const firstNode = laNodes[firstIndex];
      const cost = Cost(horse, firstNode);
      if (cost < minCost) {
        minCost = cost;
        startNode = firstNode;
      }
    }
    return startNode;
  }

  private raceAStar(
    startNode: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[],
    pathLength = 10
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
    let progress = startNode.progress;
    let lane = this.findBestLane(
      startNode.progress,
      startNode.lane,
      horse,
      others
    );
    const prIndex = progressIndex(progress, this.nodes.length);
    const prPostIndex = (prIndex + 1) % this.nodes.length;
    const prIndices = [prIndex, prPostIndex];
    for (const prIndex of prIndices) {
      const prNodes = this.nodes[prIndex];
      const laNodes = prNodes[lane];
      const laNodeIndex = findNearestIndexInPath(laNodes, progress, true);
      if (laNodeIndex !== null) {
        return laNodes[laNodeIndex];
      }
    }
    return null;
  }

  private findBestLane(
    progress: number,
    lane: number,
    horse: RaceHorse,
    others: RaceHorse[]
  ): number {
    if (this.isLaneSafe(progress, lane, horse, others)) {
      return lane;
    }
    const prIndex = progressIndex(progress, this.nodes.length);
    const prNodes = this.nodes[prIndex];
    for (let offset = 1; offset <= 4; offset++) {
      const rightLaIndex = lane + offset;
      if (rightLaIndex < 0 || prNodes.length <= rightLaIndex) {
        if (this.isLaneSafe(progress, rightLaIndex, horse, others)) {
          return rightLaIndex;
        }
      }
      const leftLaIndex = lane - offset;
      if (leftLaIndex < 0 || prNodes.length <= leftLaIndex) {
        if (this.isLaneSafe(progress, leftLaIndex, horse, others)) {
          return leftLaIndex;
        }
      }
    }
    return lane;
  }

  private isLaneSafe(
    progress: number,
    lane: number,
    horse: RaceHorse,
    others: RaceHorse[]
  ): boolean {
    for (const other of others) {
      if (horse.horseId === other.horseId) {
        continue;
      }
      if (lane !== other.raceLane) {
        continue;
      }
      const comparison = isProgressInFront(progress, other.progress);
      if (comparison !== 1) {
        continue;
      }
      // todo: check distance
    }
    return true;
  }
}

export function createNodes(
  track: RaceTrack,
  trackWidth: number,
  nodeResolution: number,
  trackPadding: number,
  gridResolution: number = 150,
  progressResolution: number = 10
): RaceSegmentNode[][][] {
  const gridNodes = new Map<string, RaceSegmentNode[]>();
  const nodes: RaceSegmentNode[][][] = Array.from(
    { length: progressResolution },
    () => []
  );
  for (const segment of track.segments) {
    const segmentNodes = segment.getSampleNodes(
      trackWidth,
      nodeResolution,
      trackPadding
    );
    const segmentLength = segment.length;
    const segmentProgress = segmentLength / track.trackLength;
    let laIndex = 0;
    for (
      let lane = trackPadding;
      lane <= trackWidth - trackPadding;
      lane += nodeResolution
    ) {
      const laNodes = segmentNodes[laIndex];
      for (const node of laNodes) {
        const nodeKey = gridKey(node.x, node.y, gridResolution);
        const nodeProgress = node.progress * segmentProgress;
        const newNode = {
          ...node,
          progress: segment.getCumulativeProgress() + nodeProgress,
        };
        const gridNode = gridNodes.get(nodeKey);
        let isNew = false;
        if (!gridNode) {
          gridNodes.set(nodeKey, [newNode]);
          isNew = true;
        } else {
          if (hasNearbyNode(gridNode, newNode, nodeResolution)) {
            continue;
          }
          gridNode.push(newNode);
          isNew = true;
        }
        if (isNew) {
          const prIndex = progressIndex(newNode.progress, progressResolution);
          let prNodes = nodes[prIndex];
          if (!prNodes) {
            prNodes = nodes[prIndex] = [];
          }
          let laNodes = prNodes[laIndex];
          if (!laNodes) {
            laNodes = prNodes[laIndex] = [];
          }
          laNodes.push(newNode);
        }
      }
      laIndex++;
    }
  }
  return nodes;
}

export function hasNearbyNode(
  gridNode: RaceSegmentNode[],
  node: RaceSegmentNode,
  nodeResolution: number
): boolean {
  const tolerance = nodeResolution * 0.85;
  for (const other of gridNode) {
    if (Distance(node, other) <= tolerance) {
      return true;
    }
  }
  return false;
}

function gridKey(x: number, y: number, nodeResolution: number): string {
  const gx = Math.floor(x / nodeResolution);
  const gy = Math.floor(y / nodeResolution);
  return `${gx},${gy}`;
}

function findNodeSections(progress: number, length: number): number[] {
  const prIndex = progressIndex(progress, length);
  const nextPrIndex = (prIndex + 1) % length;
  return [prIndex, nextPrIndex];
}

function progressIndex(progress: number, length: number): number {
  const prIndex = Math.min(9, Math.floor(progress * length));
  if (prIndex < 0 || length <= prIndex) {
    throw new Error(`Progress index out of bounds: ${prIndex}`);
  }
  return prIndex;
}

function isProgressInFront(from: number, to: number): number {
  const diff = Math.abs(to - from);
  if (diff < EPSILON) {
    return 0;
  }
  if (0.9 < from && to < 0.1) {
    return 1;
  } else if (from < to) {
    if (from < 0.1 && 0.9 < to) {
      return -1;
    }
    return 1;
  } else {
    return -1;
  }
}

function findNearestIndexInPath(
  path: RaceSegmentNode[],
  progress: number,
  mustFront: boolean
): number | null {
  if (path.length === 0) {
    return null;
  }
  let left = 0;
  let right = path.length - 1;
  let index: number | null = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midNode = path[mid];
    const comparison = isProgressInFront(progress, midNode.progress);
    if (mustFront) {
      if (comparison === 1) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    } else {
      if (comparison !== -1) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
  }
  return index;
}
