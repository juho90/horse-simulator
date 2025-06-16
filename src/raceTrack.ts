export interface RaceLine {
  type: "line";
  start: number; // 시작 위치(m)
  end: number; // 끝 위치(m)
}

export interface RaceCorner {
  type: "corner";
  start: number; // 시작 위치(m)
  end: number; // 끝 위치(m)
  arc: {
    cx: number; // 중심 x (뷰어에서 계산)
    cy: number; // 중심 y (뷰어에서 계산)
    r: number; // 반지름 (뷰어에서 계산)
    startAngle: number;
    endAngle: number;
    sweep: 0 | 1;
  };
}

export type RaceSegment = RaceLine | RaceCorner;

export interface RaceTrack {
  length: number;
  segments: RaceSegment[];
}

export function createTrack(): RaceTrack {
  // 트랙 길이: 1200~3600m, 100m 단위
  const length = 1200 + Math.floor(Math.random() * 25) * 100; // 1200~3600
  // 코너 개수: 2~4개
  const cornerCount = 2 + Math.floor(Math.random() * 3); // 2~4
  const minCornerLen = 100;
  const maxCornerLen = 300;
  const minGap = 100;
  let used: number[] = [];
  let segments: RaceSegment[] = [];
  let lastEnd = 0;
  for (let i = 0; i < cornerCount; i++) {
    let start = 0;
    let valid = false;
    while (!valid) {
      start =
        minGap + Math.floor(Math.random() * (length - maxCornerLen - minGap));
      valid = !used.some((u) => Math.abs(u - start) < maxCornerLen + minGap);
      if (valid) used.push(start);
    }
    const cornerLen =
      minCornerLen +
      Math.floor(Math.random() * (maxCornerLen - minCornerLen + 1));
    let end = Math.min(start + cornerLen, length - minGap);
    // 직선 구간 추가
    if (start > lastEnd) {
      segments.push({ type: "line", start: lastEnd, end: start } as RaceLine);
    }
    // 코너 구간 추가 (arc 정보는 placeholder, 뷰어에서 계산)
    segments.push({
      type: "corner",
      start,
      end,
      arc: {
        cx: 0,
        cy: 0,
        r: 0,
        startAngle: 0,
        endAngle: 0,
        sweep: 1,
      },
    } as RaceCorner);
    lastEnd = end;
  }
  // 마지막 직선 구간
  if (lastEnd < length) {
    segments.push({ type: "line", start: lastEnd, end: length });
  }
  // 시작점 기준 정렬
  segments = segments.sort((a, b) => a.start - b.start);
  return { length, segments };
}
