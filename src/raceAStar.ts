// raceAStar.ts
// 레인 중심선 노드 기반 A* 경로 탐색 알고리즘 예시

export interface AStarNode {
  x: number;
  y: number;
  progress: number;
  g: number; // 시작점에서 현재 노드까지의 비용
  h: number; // 목표까지의 휴리스틱 비용
  f: number; // 총 비용(g + h)
  parent?: AStarNode;
}

export function findAStarPath(
  nodes: Array<{ x: number; y: number; progress: number }>,
  start: { x: number; y: number },
  goal: { x: number; y: number },
  obstacles: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  // 노드 매핑: 가장 가까운 노드 찾기
  function getClosestNode(pos: { x: number; y: number }) {
    return nodes.reduce((a, b) =>
      Math.hypot(a.x - pos.x, a.y - pos.y) <
      Math.hypot(b.x - pos.x, b.y - pos.y)
        ? a
        : b
    );
  }
  const startNode = getClosestNode(start);
  const goalNode = getClosestNode(goal);

  // 장애물 비용 함수
  function obstacleCost(node: { x: number; y: number }) {
    let cost = 0;
    for (const obs of obstacles) {
      const d = Math.hypot(node.x - obs.x, node.y - obs.y);
      if (d < 10) cost += 1000; // 충돌 위험 매우 높음
      else if (d < 30) cost += 100; // 근접 위험
    }
    return cost;
  }

  // A* 탐색
  const open: AStarNode[] = [];
  const closed: Set<string> = new Set();
  open.push({
    ...startNode,
    g: 0,
    h: Math.hypot(startNode.x - goalNode.x, startNode.y - goalNode.y),
    f: 0,
  });

  while (open.length > 0) {
    // f값이 가장 작은 노드 선택
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;
    closed.add(key);
    // 목표 도달
    if (Math.hypot(current.x - goalNode.x, current.y - goalNode.y) < 5) {
      // 경로 역추적
      const path: Array<{ x: number; y: number }> = [];
      let node: AStarNode | undefined = current;
      while (node) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path.reverse();
    }
    // 인접 노드(진행 방향으로만)
    const idx = nodes.findIndex((n) => n.x === current.x && n.y === current.y);
    const neighbors: AStarNode[] = [];
    if (idx + 1 < nodes.length) {
      neighbors.push({ ...nodes[idx + 1], g: 0, h: 0, f: 0 });
    }
    if (idx - 1 >= 0) {
      neighbors.push({ ...nodes[idx - 1], g: 0, h: 0, f: 0 });
    }
    for (const neighbor of neighbors) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (closed.has(nKey)) continue;
      const tentativeG =
        current.g +
        Math.hypot(current.x - neighbor.x, current.y - neighbor.y) +
        obstacleCost(neighbor);
      if (
        !open.find((n) => n.x === neighbor.x && n.y === neighbor.y) ||
        tentativeG < neighbor.g
      ) {
        neighbor.g = tentativeG;
        neighbor.h = Math.hypot(
          neighbor.x - goalNode.x,
          neighbor.y - goalNode.y
        );
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.parent = current;
        if (!open.find((n) => n.x === neighbor.x && n.y === neighbor.y)) {
          open.push(neighbor);
        }
      }
    }
  }
  // 경로 없음
  return [];
}
