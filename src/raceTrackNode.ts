import { Distance, EPSILON } from "./raceMath";
import { RaceSegmentNode } from "./raceSegment";
import { RaceTrack } from "./raceTrack";

export class RaceTrackNode {
  private progressResolution: number;
  private gridNodes: Map<string, RaceSegmentNode[]>;
  private segmentNodes: Map<number, RaceSegmentNode[][]>;
  private allNodes: RaceSegmentNode[][][];
  private laLength: number;

  constructor(
    track: RaceTrack,
    trackWidth: number,
    trackPadding: number,
    nodeResolution: number,
    progressResolution: number = 10,
    gridResolution: number = 150
  ) {
    this.progressResolution = progressResolution;
    let laMaxIndex = 0;
    for (
      let lane = trackPadding;
      lane <= trackWidth - trackPadding;
      lane += nodeResolution
    ) {
      ++laMaxIndex;
    }
    const gridNodes = new Map<string, RaceSegmentNode[]>();
    const segmentNodes = new Map<number, RaceSegmentNode[][]>();
    const allNodes: RaceSegmentNode[][][] = Array.from(
      { length: progressResolution },
      () => []
    );
    for (const segment of track.getSegments()) {
      const newNodes: RaceSegmentNode[][] = [];
      const sampleNodes = segment.getNodes(
        trackWidth,
        nodeResolution,
        trackPadding
      );
      const segmentLength = segment.length;
      const segmentProgress = segmentLength / track.getTrackLength();
      for (let laIndex = 0; laIndex < laMaxIndex; ++laIndex) {
        const laNodes = sampleNodes[laIndex];
        for (const node of laNodes) {
          const nodeKey = gridKey(node.x, node.y, gridResolution);
          const nodeProgress = node.progress * segmentProgress;
          const newProgress = segment.getCumulativeProgress() + nodeProgress;
          const newNode = {
            ...node,
            progress: newProgress,
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
            let laNodes = newNodes[laIndex];
            if (!laNodes) {
              laNodes = newNodes[laIndex] = [];
            }
            laNodes.push(newNode);
          }
          if (isNew) {
            const prIndex = this.progressIndex(newNode.progress);
            let prNodes = allNodes[prIndex];
            if (!prNodes) {
              prNodes = allNodes[prIndex] = [];
            }
            let laNodes = prNodes[laIndex];
            if (!laNodes) {
              laNodes = prNodes[laIndex] = [];
            }
            laNodes.push(newNode);
          }
        }
      }
      segmentNodes.set(segment.segmentIndex, newNodes);
    }
    this.gridNodes = gridNodes;
    this.segmentNodes = segmentNodes;
    this.allNodes = allNodes;
    this.laLength = laMaxIndex;
  }

  getLaneLength(): number {
    return this.laLength;
  }

  getNodes(): RaceSegmentNode[][][] {
    return this.allNodes;
  }

  getProgressNodes(prIndex: number): RaceSegmentNode[][] {
    if (prIndex < 0 || this.progressResolution <= prIndex) {
      throw new Error(`Progress index out of bounds: ${prIndex}`);
    }
    return this.allNodes[prIndex];
  }

  getLaneNodes(prIndex: number, laneIndex: number): RaceSegmentNode[] {
    const prNodes = this.getProgressNodes(prIndex);
    if (laneIndex < 0 || prNodes.length <= laneIndex) {
      throw new Error(`Lane index out of bounds: ${laneIndex}`);
    }
    return prNodes[laneIndex];
  }

  getGateNodes(): RaceSegmentNode[] {
    const gateNodes: RaceSegmentNode[] = [];
    const prIndex = 0;
    const prNodes = this.allNodes[prIndex];
    for (const laNodes of prNodes) {
      const firstNode = laNodes[0];
      if (EPSILON < firstNode.progress) {
        throw new Error("First node progress should be zero");
      }
      gateNodes.push(firstNode);
    }
    return gateNodes;
  }

  findPrevNode(lane: number, progress: number): RaceSegmentNode | null {
    let startNode: RaceSegmentNode | null = null;
    const prIndex = this.progressIndex(progress);
    const prPostIndex = this.progressNextIndex(prIndex);
    const prIndices = [prIndex, prPostIndex];
    for (const prIndex of prIndices) {
      const laNodes = this.getLaneNodes(prIndex, lane);
      let firstIndex = findNearestIndexInPath(laNodes, progress);
      if (firstIndex === null) {
        firstIndex = laNodes.length - 1;
      } else {
        if (0 < firstIndex) {
          --firstIndex;
        }
      }
      const firstNode = laNodes[firstIndex];
      if (startNode) {
        const horseCheck = compareProgress(progress, firstNode.progress);
        if (0 < horseCheck) {
          continue;
        }
        const startCheck = compareProgress(
          startNode.progress,
          firstNode.progress
        );
        if (0 < startCheck) {
          startNode = firstNode;
        }
      } else {
        startNode = firstNode;
      }
    }
    return startNode;
  }

  findPostNode(lane: number, progress: number): RaceSegmentNode | null {
    const prIndex = this.progressIndex(progress);
    const prPostIndex = this.progressNextIndex(prIndex);
    const prIndices = [prIndex, prPostIndex];
    for (const prIndex of prIndices) {
      const laNodes = this.getLaneNodes(prIndex, lane);
      const laNodeIndex = findNearestIndexInPath(laNodes, progress);
      if (laNodeIndex !== null) {
        return laNodes[laNodeIndex];
      }
    }
    return null;
  }

  progressIndex(progress: number): number {
    const prIndex = Math.min(9, Math.floor(progress * this.progressResolution));
    if (prIndex < 0 || this.progressResolution <= prIndex) {
      throw new Error(`Progress index out of bounds: ${prIndex}`);
    }
    return prIndex;
  }

  progressNextIndex(prIndex: number): number {
    if (prIndex < 0 || this.progressResolution <= prIndex) {
      throw new Error(`Progress index out of bounds: ${prIndex}`);
    }
    return (prIndex + 1) % this.progressResolution;
  }

  getSegmentNodes(segmentIndex: number): RaceSegmentNode[][] {
    const segmentNodes = this.segmentNodes.get(segmentIndex);
    if (!segmentNodes) {
      throw new Error(`Segment index out of bounds: ${segmentIndex}`);
    }
    return segmentNodes;
  }

  getSegmentLaneNodes(
    segmentIndex: number,
    laneIndex: number
  ): RaceSegmentNode[] {
    const segmentNodes = this.getSegmentNodes(segmentIndex);
    if (laneIndex < 0 || segmentNodes.length <= laneIndex) {
      throw new Error(`Lane index out of bounds: ${laneIndex}`);
    }
    return segmentNodes[laneIndex];
  }

  getSegmentGateNodes(segmentIndex: number): RaceSegmentNode[] {
    const segmentNodes = this.getSegmentNodes(segmentIndex);
    const gateNodes: RaceSegmentNode[] = [];
    for (const laneNodes of segmentNodes) {
      const firstNode = laneNodes[0];
      gateNodes.push(firstNode);
    }
    return gateNodes;
  }
}

function hasNearbyNode(
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

export function compareProgress(from: number, to: number): number {
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

export function findNearestIndexInPath(
  path: RaceSegmentNode[],
  progress: number
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
    const comparison = compareProgress(progress, midNode.progress);
    if (comparison === 1) {
      index = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return index;
}
