import { RaceHorse } from "./raceHorse";
import { Cost, Distance } from "./raceMath";
import { RaceSegmentNode, TRACK_WIDTH } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export interface AStarNode {
  node: RaceSegmentNode;
  g: number;
  h: number;
  f: number;
  parent?: AStarNode;
}

export class RacePathfinder {
  track: RaceTrack;
  progressNodes: RaceSegmentNode[][];

  constructor(track: RaceTrack) {
    this.track = track;
    const gridNodes = createGridNodes(track, TRACK_WIDTH, 15, 10, 150);
    this.progressNodes = convertGridNodesToProgress(gridNodes);
  }

  findPath(horse: RaceHorse, others: RaceHorse[]): RaceSegmentNode[] | null {
    const startNode = this.findStartNode(horse, others);
    if (!startNode) {
      return null;
    }
    return this.raceAStar(startNode, others);
  }

  findStartNode(horse: RaceHorse, others: RaceHorse[]): RaceSegmentNode | null {
    let startNode: RaceSegmentNode | null = null;
    let minCost = Infinity;
    for (const progressNode of this.progressNodes) {
      for (const node of progressNode) {
        let tooClose = false;
        for (const other of others) {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 10) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
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
    others: RaceHorse[]
  ): RaceSegmentNode[] | null {
    const open: AStarNode[] = [];
    const closed = new Set<string>();
    open.push({
      node: startNode,
      g: 0,
      h: 0,
      f: 0,
    });
    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      const path: RaceSegmentNode[] = [];
      let n: AStarNode | undefined = current;
      while (n) {
        path.push(n.node);
        n = n.parent;
      }
      const reversedPath = path.reverse();
      if (reversedPath.length >= 10) {
        return reversedPath.slice(0, 10);
      }
      closed.add(nodeKey(current.node));
      let idx = Math.floor(current.node.progress * 10);
      if (idx < 0) {
        idx = 0;
      }
      if (idx > 9) {
        idx = 9;
      }
      const neighborBins = [idx];
      if (idx === 0) {
        neighborBins.push(9);
      }
      if (idx === 9) {
        neighborBins.push(0);
      }
      for (const b of neighborBins) {
        for (const neighbor of this.progressNodes[b]) {
          if (nodeKey(neighbor) === nodeKey(current.node)) {
            continue;
          }
          if (closed.has(nodeKey(neighbor))) {
            continue;
          }
          let tooClose = false;
          for (const other of others) {
            const distToOther = Math.hypot(
              neighbor.x - other.x,
              neighbor.y - other.y
            );
            if (distToOther < 10) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;
          let progressDiff = neighbor.progress - current.node.progress;
          if (progressDiff < -0.5) {
            progressDiff += 1;
          }
          if (progressDiff <= 0) {
            continue;
          }
          if (
            neighbor.segmentIndex !== current.node.segmentIndex &&
            Math.abs(progressDiff) > 0.1
          ) {
            continue;
          }
          const dist = Math.hypot(
            current.node.x - neighbor.x,
            current.node.y - neighbor.y
          );
          if (dist > 20) {
            continue;
          }
          const g = current.g + dist;
          const hVal = 0;
          const f = g;
          const existing = open.find(
            (n) => nodeKey(n.node) === nodeKey(neighbor)
          );
          if (existing && existing.f <= f) {
            continue;
          }
          open.push({ node: neighbor, g, h: hVal, f, parent: current });
        }
      }
    }
    return null;
  }
}

export function convertGridNodesToProgress(
  gridNodes: Map<string, RaceSegmentNode[]>
): RaceSegmentNode[][] {
  const progresssArr: RaceSegmentNode[][] = Array.from(
    { length: 10 },
    () => []
  );
  for (const nodeArr of gridNodes.values()) {
    for (const node of nodeArr) {
      const idx = Math.min(9, Math.floor(node.progress * 10));
      progresssArr[idx].push(node);
    }
  }
  return progresssArr;
}

export function createGridNodes(
  track: RaceTrack,
  trackWidth: number,
  nodeResolution: number,
  nodePadding: number,
  gridResolution: number
): Map<string, RaceSegmentNode[]> {
  let accumulatedLength = 0;
  const gridNodes = new Map<string, RaceSegmentNode[]>();
  for (const segment of track.segments) {
    const segmentNodes = segment.getSampleNodes(
      trackWidth,
      nodeResolution,
      nodePadding
    );
    const segmentLength = segment.length;
    for (const node of segmentNodes) {
      const nodeKey = gridKey(node.x, node.y, gridResolution);
      const nodeDistance = segmentLength * node.progress;
      const totalDistance = accumulatedLength + nodeDistance;
      const trackProgress = totalDistance / track.trackLength;
      const newNode = { ...node, progress: trackProgress };
      const gridNode = gridNodes.get(nodeKey);
      if (!gridNode) {
        gridNodes.set(nodeKey, [newNode]);
      } else {
        if (hasNearbyNode(gridNode, newNode, nodeResolution)) {
          continue;
        }
        gridNode.push(newNode);
      }
    }
    accumulatedLength += segmentLength;
  }
  return gridNodes;
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
