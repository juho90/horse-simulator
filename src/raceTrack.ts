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
  trackLength: number; // 경기장 전체 한 바퀴 거리
  raceLength: number; // 이번 경주 거리(한 바퀴 이하 또는 n바퀴)
  segments: RaceSegment[];
  start: number; // 출발점(트랙 거리상 위치, m)
  finish: number; // 결승점(트랙 거리상 위치, m)
}

export function createTrack(): RaceTrack {
  // 경기장 한 바퀴 거리: 1200~3600m, 100m 단위
  const trackLength = 1200 + Math.floor(Math.random() * 25) * 100; // 1200~3600
  // 경주 거리: 한 바퀴~두 바퀴(예시)
  const minRace = trackLength * 0.7;
  const maxRace = trackLength * 2;
  const raceLength =
    minRace + Math.floor(Math.random() * (maxRace - minRace + 1));
  // 출발점: 0~trackLength-1 중 임의 위치
  const start = Math.floor(Math.random() * trackLength);
  // 결승점: 출발점에서 raceLength만큼 떨어진 위치(트랙을 한 바퀴 이상 돌 수 있음)
  let finish = (start + raceLength) % trackLength;
  // 코너 개수: 2~4개
  const cornerCount = 2 + Math.floor(Math.random() * 3); // 2~4
  // 각 코너의 각도(라디안) = 2π / cornerCount
  const cornerAngle = (2 * Math.PI) / cornerCount;
  // 각 코너의 길이(비율): 전체 트랙의 1/3~1/2를 코너로 할당
  const cornerTotalLen = trackLength * (0.4 + Math.random() * 0.2); // 40~60%
  const cornerLen = cornerTotalLen / cornerCount;
  // 직선 구간 개수 = 코너 개수
  const straightCount = cornerCount;
  const straightTotalLen = trackLength - cornerTotalLen;
  const straightLen = straightTotalLen / straightCount;
  // segments 생성(코너-직선 반복, 각도 누적)
  let segments: RaceSegment[] = [];
  let accLen = 0;
  let accAngle = 0;
  for (let i = 0; i < cornerCount; i++) {
    // 코너
    segments.push({
      type: "corner",
      start: accLen,
      end: accLen + cornerLen,
      arc: {
        cx: 0,
        cy: 0,
        r: 0,
        startAngle: accAngle,
        endAngle: accAngle + cornerAngle,
        sweep: 1,
      },
    } as RaceCorner);
    accLen += cornerLen;
    accAngle += cornerAngle;
    // 직선
    segments.push({
      type: "line",
      start: accLen,
      end: accLen + straightLen,
    } as RaceLine);
    accLen += straightLen;
  }
  // 마지막 wrap-around 보정(총합이 trackLength와 정확히 일치하도록)
  if (accLen < trackLength) {
    segments.push({
      type: "line",
      start: accLen,
      end: trackLength,
    } as RaceLine);
  }
  return { trackLength, raceLength, segments, start, finish };
}
