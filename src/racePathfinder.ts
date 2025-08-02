import { RaceHorse } from "./raceHorse";
import { Cost, Distance, EPSILON } from "./raceMath";
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
  nodes: RaceSegmentNode[][][];

  constructor(track: RaceTrack, nodeResolution: number = 15) {
    this.track = track;
    this.nodeResolution = nodeResolution;
    this.nodes = createNodes(track, TRACK_WIDTH, nodeResolution, 10, 150);
  }

  findPath(horse: RaceHorse, others: RaceHorse[]): RaceSegmentNode[] | null {
    const startNode = this.findStartNode(horse, others);
    if (!startNode) {
      return null;
    }
    return this.raceAStar(startNode, horse, others);
  }

  findStartNode(horse: RaceHorse, others: RaceHorse[]): RaceSegmentNode | null {
    let startNode = horse.getCurrentNode();
    if (startNode) {
      return startNode;
    }
    const progress = this.track.getTrackProgress(0, horse);
    const prIndex = Math.floor(progress * this.nodes.length);
    const prNodes = this.nodes[prIndex];
    let minCost = Infinity;
    for (const laNodes of prNodes) {
      for (const node of laNodes) {
        if (startNode && startNode.progress < node.progress) {
          continue;
        }
        let tooClose = false;
        for (const other of others) {
          const cost = Cost(node, other);
          if (cost < horse.speed) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) {
          continue;
        }
        const cost = Cost(horse, node);
        if (cost < minCost) {
          minCost = cost;
          startNode = node;
        }
      }
    }
    if (!startNode) {
      return null;
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
      if (current.node) {
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
          if (this.isBlockedByOthers(nearestNode, horse, others)) {
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

  private findNodeSections(node: RaceSegmentNode): number[] {
    const prIndex = Math.floor(node.progress * this.nodes.length);
    const nextPrIndex = (prIndex + 1) % this.nodes.length;
    return [prIndex, nextPrIndex];
  }

  private findNearestNodes(
    startNode: RaceSegmentNode
  ): (RaceSegmentNode | null)[] {
    const nodeSections = this.findNodeSections(startNode);
    const laIndexs = [startNode.lane - 1, startNode.lane, startNode.lane + 1];
    const nearestNodes: (RaceSegmentNode | null)[] = new Array(laIndexs.length);
    nearestNodes.fill(null);
    for (const nodeSection of nodeSections) {
      const sectionNodes = this.nodes[nodeSection];
      for (const laIndex of laIndexs) {
        if (laIndex < 0 || sectionNodes.length <= laIndex) {
          continue;
        }
        const laneNodes = sectionNodes[laIndex];
        for (const node of laneNodes) {
          if (nearestNodes[laIndex]) {
            continue;
          }
          if (startNode.progress < node.progress) {
            nearestNodes[laIndex] = node;
            break;
          }
        }
      }
    }
    return nearestNodes;
  }

  private isBlockedByOthers(
    node: RaceSegmentNode,
    raceHorse: RaceHorse,
    others: RaceHorse[]
  ) {
    for (const other of others) {
      if (Cost(node, other) < raceHorse.speed) {
        return true;
      }
    }
    return false;
  }
}

export function createNodes(
  track: RaceTrack,
  trackWidth: number,
  nodeResolution: number,
  nodePadding: number,
  gridResolution: number
): RaceSegmentNode[][][] {
  let accumulatedLength = 0;
  const gridNodes = new Map<string, RaceSegmentNode[]>();
  const nodes: RaceSegmentNode[][][] = Array.from({ length: 10 }, () => []);
  for (const segment of track.segments) {
    const segmentNodes = segment.getSampleNodes(
      trackWidth,
      nodeResolution,
      nodePadding
    );
    const segmentLength = segment.length;
    let laIndex = 0;
    for (
      let lane = nodePadding;
      lane <= trackWidth - nodePadding;
      lane += nodeResolution
    ) {
      const laneNodes = segmentNodes[laIndex];
      for (const node of laneNodes) {
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
          const prIndex = Math.min(9, Math.floor(newNode.progress * 10));
          if (prIndex < 0 || prIndex >= 10) {
            throw new Error(`Progress index out of bounds: ${prIndex}`);
          }
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

export function findNearestNodeIndex(
  path: RaceSegmentNode[],
  progress: number
): number {
  let currentNodeIndex = -1;
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const diffProgress = node.progress - progress;
    if (diffProgress < EPSILON) {
      continue;
    }
    currentNodeIndex = i;
    break;
  }
  return currentNodeIndex;
}
