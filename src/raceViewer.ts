import { RaceTrack } from "./raceTrack";

export function generateRaceHtml(raceLog: any[], track: RaceTrack) {
  const width = 900;
  const height = 500;
  const margin = 60;
  const centerX = width / 2;
  const centerY = height / 2;
  const trackLength = track.length;
  // 트랙을 시계방향으로 그림
  // 트랙을 직선-코너-직선-코너 순서로 배치 (코너 2개만 지원, 4각형 형태)
  // 코너 반지름은 SVG 영역에 맞게 자동 계산
  // 1. 구간 리스트 생성
  // 2. 각 구간의 시작점, 방향, 길이, (코너는 반지름/각도) 계산
  // 3. SVG path 생성 및 말 위치 계산에 활용

  // 트랙 구간 분해
  const cornerSegments = track.segments.filter(
    (s) => s.type === "corner"
  ) as any[];
  const totalCornerLen = cornerSegments.reduce(
    (sum, c) => sum + (c.end - c.start),
    0
  );
  const straightLen = (track.length - totalCornerLen) / 2;
  const cornerLen = cornerSegments.map((c) => c.end - c.start);

  // SVG에서 사용할 트랙 크기(최대 반지름)
  const r = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  // 코너 반지름 (SVG상)
  const cornerRadius = r * 0.6;
  // 직선 길이 (SVG상)
  const straightSvgLen = r * 1.2;

  // 트랙 구간 리스트 (직선/코너)
  // 각 구간을 'line'과 'arc'로 분리, arc는 중심/반지름/각도 등 명확히 표시
  function buildSegments() {
    // 트랙의 네 꼭짓점(시작점 기준 시계방향)
    const x1 = centerX - straightSvgLen / 2;
    const y1 = centerY - cornerRadius;
    const x2 = centerX + straightSvgLen / 2;
    const y2 = centerY - cornerRadius;
    const x3 = centerX + straightSvgLen / 2;
    const y3 = centerY + cornerRadius;
    const x4 = centerX - straightSvgLen / 2;
    const y4 = centerY + cornerRadius;
    // 각 코너의 중심
    const c1 = { cx: x2, cy: y2 + cornerRadius };
    const c2 = { cx: x3 - cornerRadius, cy: y3 };
    const c3 = { cx: x4, cy: y4 - cornerRadius };
    const c4 = { cx: x1 + cornerRadius, cy: y1 };
    // 각 구간 길이
    const straight = straightSvgLen;
    const arcLen = (Math.PI * cornerRadius) / 2; // 90도 원호
    return [
      { type: "line", x1, y1, x2, y2, length: straight },
      {
        type: "arc",
        cx: c1.cx,
        cy: c1.cy,
        r: cornerRadius,
        startAngle: 270,
        endAngle: 360,
        sweep: 1,
        length: arcLen,
      },
      {
        type: "line",
        x1: x3,
        y1: y3 - cornerRadius,
        x2: x4,
        y2: y4 - cornerRadius,
        length: straight,
      },
      {
        type: "arc",
        cx: c3.cx,
        cy: c3.cy,
        r: cornerRadius,
        startAngle: 0,
        endAngle: 90,
        sweep: 1,
        length: arcLen,
      },
      {
        type: "line",
        x1: x4,
        y1: y4,
        x2: x1,
        y2: y1 + cornerRadius,
        length: straight,
      },
      {
        type: "arc",
        cx: c4.cx,
        cy: c4.cy,
        r: cornerRadius,
        startAngle: 90,
        endAngle: 180,
        sweep: 1,
        length: arcLen,
      },
      {
        type: "line",
        x1: x1,
        y1: y1 + cornerRadius,
        x2: x2,
        y2: y2,
        length: straight,
      },
      {
        type: "arc",
        cx: c1.cx,
        cy: c1.cy,
        r: cornerRadius,
        startAngle: 180,
        endAngle: 270,
        sweep: 1,
        length: arcLen,
      },
    ];
  }
  const segments = buildSegments();

  // SVG 경로 생성
  function buildTrackPath() {
    let path = [`M ${segments[0].x1},${segments[0].y1}`];
    for (const seg of segments) {
      if (seg.type === "line" && seg.x2 !== undefined && seg.y2 !== undefined) {
        path.push(`L ${seg.x2},${seg.y2}`);
      } else if (
        seg.type === "arc" &&
        seg.cx !== undefined &&
        seg.cy !== undefined &&
        seg.r !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined &&
        seg.sweep !== undefined
      ) {
        const largeArc = Math.abs(seg.endAngle - seg.startAngle) > 180 ? 1 : 0;
        const ex = seg.cx + seg.r * Math.cos((seg.endAngle * Math.PI) / 180);
        const ey = seg.cy + seg.r * Math.sin((seg.endAngle * Math.PI) / 180);
        path.push(`A ${seg.r} ${seg.r} 0 ${largeArc} ${seg.sweep} ${ex},${ey}`);
      }
    }
    path.push("Z");
    return path.join(" ");
  }

  // 말 위치 계산: 누적 거리로 구간 판별 후 좌표 계산
  function getHorsePosition(distance: number, offset = 0) {
    let d = distance;
    for (const seg of segments) {
      if (d <= seg.length) {
        if (
          seg.type === "line" &&
          seg.x1 !== undefined &&
          seg.y1 !== undefined &&
          seg.x2 !== undefined &&
          seg.y2 !== undefined
        ) {
          const t = d / seg.length;
          return {
            x: seg.x1 + (seg.x2 - seg.x1) * t,
            y: seg.y1 + (seg.y2 - seg.y1) * t - offset,
          };
        } else if (
          seg.type === "arc" &&
          seg.cx !== undefined &&
          seg.cy !== undefined &&
          seg.r !== undefined &&
          seg.startAngle !== undefined &&
          seg.endAngle !== undefined
        ) {
          const t = d / seg.length;
          const angle = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
          return {
            x: seg.cx + seg.r * Math.cos((angle * Math.PI) / 180),
            y: seg.cy + seg.r * Math.sin((angle * Math.PI) / 180) - offset,
          };
        }
      }
      d -= seg.length;
    }
    // 마지막 구간을 넘어가면 트랙 끝점에 위치
    const last = segments[segments.length - 1];
    if (last.type === "line" && last.x2 !== undefined && last.y2 !== undefined)
      return { x: last.x2, y: last.y2 - offset };
    else if (
      last.type === "arc" &&
      last.cx !== undefined &&
      last.cy !== undefined
    )
      return { x: last.cx, y: last.cy - offset };
    else return { x: 0, y: 0 };
  }

  const trackPath = buildTrackPath();

  return `
<!DOCTYPE html>
<html lang='ko'>
<head>
  <meta charset='UTF-8'>
  <title>경마 시뮬레이터 뷰어</title>
  <style>
    body { background: #222; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
    #track { background: #f4f4f4; border-radius: 20px; box-shadow: 0 4px 32px #0004; }
    #controls { margin: 16px 0; }
    button { font-size: 1.2em; border-radius: 6px; border: 1px solid #888; background: #fff; color: #222; margin-right: 6px; padding: 4px 12px; }
    h1 { font-size: 2.2em; font-weight: bold; margin-bottom: 0.2em; }
  </style>
</head>
<body>
  <h1>경마 시뮬레이터</h1>
  <div id='controls'>
    <button onclick='prevTurn()'>◀ 이전</button>
    <span id='turnInfo'></span>
    <button onclick='nextTurn()'>다음 ▶</button>
    <button onclick='togglePlay()' id='playBtn'>▶ 재생</button>
  </div>
  <svg id='track' width='${width}' height='${height}'>
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e0e0e0"/>
        <stop offset="100%" stop-color="#bdbdbd"/>
      </linearGradient>
    </defs>
    <path d='${trackPath}' stroke='url(#trackGrad)' stroke-width='22' fill='none' filter='url(#shadow)' stroke-linecap='round' stroke-linejoin='round'/>
    <g id='horses'></g>
  </svg>
  <script>
    const raceLog = ${JSON.stringify(raceLog)};
    const width = ${width}, height = ${height};
    const margin = ${margin};
    const centerX = ${centerX}, centerY = ${centerY};
    const straightSvgLen = ${straightSvgLen};
    const cornerRadius = ${cornerRadius};
    const segments = ${JSON.stringify(segments)};
    function getHorsePosition(distance, offset=0) {
      let d = distance;
      let x = centerX - straightSvgLen / 2;
      let y = centerY - cornerRadius;
      let dir = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (d <= seg.length) {
          if (seg.type === 'straight') {
            const t = d / seg.length;
            const dx = Math.cos((dir * Math.PI) / 180) * straightSvgLen * t;
            const dy = Math.sin((dir * Math.PI) / 180) * straightSvgLen * t;
            return {
              x: x + dx,
              y: y + dy - offset,
            };
          } else {
            const theta0 = dir;
            const theta = theta0 + (seg.angle * d) / seg.length;
            const cx = x + Math.cos(((dir + 90) * Math.PI) / 180) * seg.radius;
            const cy = y + Math.sin(((dir + 90) * Math.PI) / 180) * seg.radius;
            return {
              x: cx + Math.cos(((theta - 180) * Math.PI) / 180) * seg.radius,
              y: cy + Math.sin(((theta - 180) * Math.PI) / 180) * seg.radius - offset,
            };
          }
        }
        if (seg.type === 'straight') {
          x += Math.cos((dir * Math.PI) / 180) * straightSvgLen;
          y += Math.sin((dir * Math.PI) / 180) * straightSvgLen;
        } else if (seg.type === 'corner' && seg.radius !== undefined && seg.angle !== undefined) {
          const arcEndDir = (dir + seg.angle) % 360;
          const cx = x + Math.cos(((dir + 90) * Math.PI) / 180) * seg.radius;
          const cy = y + Math.sin(((dir + 90) * Math.PI) / 180) * seg.radius;
          x = cx + Math.cos(((arcEndDir - 180) * Math.PI) / 180) * seg.radius;
          y = cy + Math.sin(((arcEndDir - 180) * Math.PI) / 180) * seg.radius;
          dir = arcEndDir;
        }
        d -= seg.length;
      }
      return { x, y: y - offset };
    }
    let turn = 0;
    let playing = false;
    const totalTurns = raceLog.length;
    const horsesLayer = document.getElementById('horses');
    const turnInfo = document.getElementById('turnInfo');
    function horsesSvg(turn) {
      const horses = raceLog[turn]?.horses || [];
      return horses.map(function(h, i) {
        const pos = getHorsePosition(h.distance, i*18-((horses.length-1)*9));
        return '<text x="' + pos.x + '" y="' + pos.y + '" font-size="28" text-anchor="middle" alignment-baseline="middle">🐎</text>';
      }).join('\n');
    }
    function render() {
      horsesLayer.innerHTML = horsesSvg(turn);
      turnInfo.textContent = '턴: ' + (turn+1) + ' / ' + totalTurns;
    }
    function prevTurn() { turn = Math.max(0, turn-1); render(); }
    function nextTurn() { turn = Math.min(totalTurns-1, turn+1); render(); }
    function togglePlay() {
      playing = !playing;
      document.getElementById('playBtn').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
      if (playing) playLoop();
    }
    function playLoop() {
      if (!playing) return;
      if (turn < totalTurns-1) {
        turn++;
        render();
        setTimeout(playLoop, 400);
      } else {
        playing = false;
        document.getElementById('playBtn').textContent = '▶ 재생';
      }
    }
    window.prevTurn = prevTurn;
    window.nextTurn = nextTurn;
    window.togglePlay = togglePlay;
    render();
  </script>
</body>
</html>
  `;
}
