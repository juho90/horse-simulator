import { RaceHorse } from "./raceHorse";
import {
  Cost,
  DiffAngle,
  Distance,
  EPSILON,
  NormalizeTheta,
  Vector2D,
} from "./raceMath";
import { RaceSegmentNode, TRACK_WIDTH } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface AStarNode {
  node: RaceSegmentNode;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
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
      for (const laNodes of prNodes) {
        const firstNode = findFirstNode(laNodes, horse.progress);
        if (!firstNode) {
          continue;
        }
        const cost = Cost(horse, firstNode);
        if (cost < minCost) {
          minCost = cost;
          startNode = firstNode;
        }
      }
    }
    return startNode;
  }

  private raceAStar(
    startNode: RaceSegmentNode,
    horse: RaceHorse,
    others: RaceHorse[]
  ): RaceSegmentNode[] | null {
    const open: AStarNode[] = [];
    const opened = new Set<string>();
    const closed = new Set<string>();
    open.push({
      node: startNode,
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    });
    let loopCount = 0;
    const maxLoop = 50;
    while (open.length > 0 && loopCount < maxLoop) {
      loopCount++;
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (!current) {
        break;
      }
      if (!current.node) {
        continue;
      }
      if (10 <= loopCount) {
        const path: RaceSegmentNode[] = [];
        let astar = current;
        while (astar) {
          if (astar.node) {
            path.push(astar.node);
          }
          if (!astar.parent) {
            break;
          }
          astar = astar.parent;
        }
        if (path.length >= 10) {
          return path.reverse().slice(0, 10);
        }
      }
      const currentNode = current.node;
      const currentKey = nodeKey(currentNode);
      closed.add(currentKey);
      const nearestNodes = this.findNearestNodes(currentNode);
      for (const nearestNode of nearestNodes) {
        if (!nearestNode) {
          continue;
        }
        const nearestKey = nodeKey(nearestNode);
        if (nearestKey === currentKey) {
          continue;
        }
        if (closed.has(nearestKey)) {
          continue;
        }
        if (opened.has(nearestKey)) {
          continue;
        }
        const laDiff = Math.abs(nearestNode.lane - currentNode.lane);
        const prDiff = Math.abs(nearestNode.progress - startNode.progress);
        const g = current.g + prDiff * 100 + laDiff * 15;
        const h = (1 - prDiff) * 100;
        const f = g + h;
        open.push({
          node: nearestNode,
          g,
          h,
          f,
          parent: current,
        });
        opened.add(nearestKey);
      }
    }
    const path: RaceSegmentNode[] = [];
    open.sort((a, b) => a.f - b.f);
    let astar = open.shift();
    while (astar) {
      if (astar.node) {
        path.push(astar.node);
      }
      if (!astar.parent) {
        break;
      }
      astar = astar.parent;
    }
    return path.reverse().slice(0, 10);
  }

  private findNearestNodes(node: RaceSegmentNode): (RaceSegmentNode | null)[] {
    const nodeSections = findNodeSections(node.progress, this.nodes.length);
    const laIndexs = [node.lane - 1, node.lane, node.lane + 1];
    const nearestNodes: (RaceSegmentNode | null)[] = new Array(laIndexs.length);
    nearestNodes.fill(null);
    for (const prIndex of nodeSections) {
      const prNodes = this.nodes[prIndex];
      for (const laIndex of laIndexs) {
        if (laIndex < 0 || prNodes.length <= laIndex) {
          continue;
        }
        const laNodes = prNodes[laIndex];
        for (const laNode of laNodes) {
          if (nearestNodes[laIndex]) {
            continue;
          }
          if (node.progress < laNode.progress) {
            nearestNodes[laIndex] = laNode;
            break;
          }
        }
      }
    }
    return nearestNodes;
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

function nodeKey(n: RaceSegmentNode) {
  return `${n.x.toFixed(2)},${n.y.toFixed(2)}`;
}

export function findFirstNode(
  nodes: RaceSegmentNode[],
  progress: number
): RaceSegmentNode | null {
  let left = 0;
  let right = nodes.length - 1;
  let result: RaceSegmentNode | null = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midNode = nodes[mid];
    if (midNode.progress > progress) {
      result = midNode;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return result;
}

export function findNearestNodeIndex(
  pos: Vector2D,
  progress: number,
  track: RaceTrack,
  path: RaceSegmentNode[]
): number {
  let currentNodeIndex = -1;
  let minDiffAnge = Infinity;
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const diffProgress = node.progress - progress;
    if (diffProgress < EPSILON) {
      continue;
    }
    const segment = track.getSegment(node.segmentIndex);
    const segmentHeading = segment.getTangentDirectionAt(pos);
    const nodeHeading = NormalizeTheta(pos, node);
    const diffAngle = Math.abs(DiffAngle(segmentHeading, nodeHeading));
    if (diffAngle < minDiffAnge) {
      minDiffAnge = diffAngle;
      currentNodeIndex = i;
    }
  }
  return currentNodeIndex;
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
