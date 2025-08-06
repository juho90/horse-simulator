import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import {
  Cost,
  Distance,
  DistanceArc,
  EPSILON,
  Lerp,
  Vector2D,
} from "./raceMath";
import { RaceSegmentNode, SegmentType, TRACK_WIDTH } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface NextPos {
  startNode: RaceSegmentNode;
  endNode: RaceSegmentNode | null;
  pos: Vector2D;
  progress: number;
  distance: number;
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

  findNextPos(
    pos: Vector2D,
    progress: number,
    remainingDistance: number,
    path: RaceSegmentNode[]
  ): NextPos {
    if (path.length < 1) {
      throw new Error("Path must contain at least one node");
    }
    let startNode: RaceSegmentNode = path[0];
    let endNode: RaceSegmentNode | null = null;
    let newPos = pos;
    let newProgress = progress;
    let distance = 0;
    const firstIndex = findNearestIndexInPath(path, progress);
    if (firstIndex === null || path.length - 1 <= firstIndex) {
      return {
        startNode: startNode,
        endNode: null,
        pos: newPos,
        progress: newProgress,
        distance: distance,
      };
    }
    startNode = path[firstIndex];
    endNode = path[firstIndex + 1];
    const segment = this.track.getSegment(startNode.segmentIndex);
    if (segment.type === SegmentType.LINE) {
      distance = Distance(startNode, endNode);
      if (remainingDistance < distance) {
        const ratio = remainingDistance / distance;
        newPos = Lerp(startNode, endNode, ratio);
        newProgress = this.track.getTrackProgress(endNode.segmentIndex, newPos);
      } else {
        newPos = endNode;
        newProgress = this.track.getTrackProgress(endNode.segmentIndex, newPos);
      }
    } else {
      const center = (segment as RaceCorner).center;
      const { angle, arcDistance } = DistanceArc(startNode, endNode, center);
      distance = arcDistance;
      if (remainingDistance < distance) {
        const ratio = remainingDistance / distance;
        newPos = {
          x: startNode.x + distance * ratio * Math.cos(angle),
          y: startNode.y + distance * ratio * Math.sin(angle),
        };
        newProgress = this.track.getTrackProgress(endNode.segmentIndex, newPos);
      } else {
        newPos = endNode;
        newProgress = this.track.getTrackProgress(endNode.segmentIndex, newPos);
      }
    }
    return {
      startNode,
      endNode,
      pos: newPos,
      progress: newProgress,
      distance,
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
      const firstIndex = findNearestIndexInPath(laNodes, horse.progress);
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
      for (const laNode of laNodes) {
        if (isProgressInFront(progress, laNode.progress)) {
          return laNode;
        }
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
      if (isProgressInFront(progress, other.progress) === false) {
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
  let accumulatedLength = 0;
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
    let laIndex = 0;
    for (
      let lane = trackPadding;
      lane <= trackWidth - trackPadding;
      lane += nodeResolution
    ) {
      const laNodes = segmentNodes[laIndex];
      for (const node of laNodes) {
        const nodeKey = gridKey(node.x, node.y, gridResolution);
        const trackProgress = track.getTrackProgress(node.segmentIndex, node);
        const newNode = { ...node, progress: trackProgress };
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
    accumulatedLength += segmentLength;
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

function isProgressInFront(from: number, to: number): boolean {
  const diff = Math.abs(to - from);
  if (diff < EPSILON) {
    return false;
  }
  if (0.9 < from && to < 0.1) {
    return true;
  } else if (from < to) {
    if (from < 0.1 && 0.9 < to) {
      return false;
    }
    return true;
  } else {
    return false;
  }
}

function findNearestIndexInPath(
  path: RaceSegmentNode[],
  progress: number
): number | null {
  let left = 0;
  let right = path.length - 1;
  let index: number | null = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    index = mid;
    const midNode = path[mid];
    if (isProgressInFront(progress, midNode.progress)) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return index;
}
