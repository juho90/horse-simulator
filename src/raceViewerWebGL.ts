import * as child_process from "child_process";
import * as fs from "fs";
import { RaceLog } from "./raceLog";
import { RaceTrack } from "./raceTrack";

export function generateRaceWebGLHtml(
  outPath: string,
  logs: RaceLog[],
  track: RaceTrack,
  intervalMs: number = 200
) {
  const segments = track.segments;
  // margin 값을 늘려 트랙이 더 작게 보이도록
  // margin을 X축(좌우) 160, Y축(상하) 60으로 다르게 적용
  const marginX = 160;
  const marginY = 60;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  segments.forEach((seg) => {
    const b = seg.getBounds();
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  });
  const trackWidth = 40;
  minX -= trackWidth + marginX;
  maxX += trackWidth + marginX;
  minY -= trackWidth + marginY;
  maxY += trackWidth + marginY;
  const width = maxX - minX;
  const height = maxY - minY;
  const horseColors = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f1c40f",
    "#9b59b6",
    "#34495e",
    "#e67e22",
    "#1abc9c",
    "#8e44ad",
    "#2c3e50",
  ];
  function toCanvas(p: { x: number; y: number }) {
    return {
      x: p.x - minX,
      y: p.y - minY,
    };
  }
  // 트랙 외곽선(세그먼트별 중심선) 샘플링
  const centerLinePoints: { x: number; y: number }[] = [];
  segments.forEach((seg) => {
    if (seg.type === "line") {
      centerLinePoints.push(seg.start);
    } else if (seg.type === "corner") {
      const res = 32;
      for (let i = 0; i <= res; i++) {
        const t = i / res;
        const theta =
          (seg as any).startAngle +
          ((seg as any).endAngle - (seg as any).startAngle) * t;
        centerLinePoints.push({
          x: (seg as any).center.x + (seg as any).radius * Math.cos(theta),
          y: (seg as any).center.y + (seg as any).radius * Math.sin(theta),
        });
      }
    }
  });
  centerLinePoints.push(segments[segments.length - 1].end);
  const js = `
    const logs = ${JSON.stringify(logs)};
    const trackPoints = ${JSON.stringify(centerLinePoints.map(toCanvas))};
    const horseColors = ${JSON.stringify(horseColors)};
    const canvas = document.getElementById('race-canvas');
    const ctx = canvas.getContext('2d');
    const width = ${width};
    const height = ${height};
    let turn = 0;
    let timer = null;
    const totalTurns = logs.length;
    function drawTrack() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
      for (let i = 1; i < trackPoints.length; i++) {
        ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(trackPoints[0].x, trackPoints[0].y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#27ae60';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', trackPoints[0].x, trackPoints[0].y - 18);
      ctx.beginPath();
      ctx.arc(trackPoints[trackPoints.length-1].x, trackPoints[trackPoints.length-1].y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText('GOAL', trackPoints[trackPoints.length-1].x, trackPoints[trackPoints.length-1].y - 18);
      ctx.restore();
    }
    function drawHorses(turnIdx) {
      const log = logs[turnIdx];
      const horses = log.horseStates;
      if (!horses) return;
      horses.forEach((horse, idx) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(horse.x - ${minX}, horse.y - ${minY}, 10, 0, 2 * Math.PI);
        ctx.fillStyle = horseColors[idx % horseColors.length];
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((idx+1).toString(), horse.x - ${minX}, horse.y - ${minY});
        ctx.restore();
      });
    }
    function drawTurnInfo(turnIdx) {
      ctx.save();
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#222';
      ctx.fillText('TURN: ' + (turnIdx+1) + ' / ' + totalTurns, width - 120, 30);
      ctx.restore();
    }
    function drawStatusPanel(turnIdx) {
      const panel = document.getElementById('status-panel');
      if (!panel) return;
      const log = logs[turnIdx];
      const horses = log.horseStates;
      if (!horses.length) {
        panel.innerHTML = '<div style="color:#888;padding:12px;">말 정보 없음</div>';
        return;
      }
      panel.innerHTML = \`<table style="width:100%;border-collapse:collapse;">
        <tr style="background:#eee;"><th>이름</th><th>순위</th><th>X</th><th>Y</th><th>속도</th></tr>
        \${horses.map((h, i) => \`<tr><td>\${h.name}</td><td style='text-align:center;'>\${i+1}</td><td>\${h.x.toFixed(1)}</td><td>\${h.y.toFixed(1)}</td><td>\${h.speed.toFixed(2)}</td></tr>\`).join('')}
      </table>\`;
    }
    function render() {
      drawTrack();
      drawHorses(turn);
      drawTurnInfo(turn);
      drawStatusPanel(turn);
    }
    function startReplay() {
      render();
      timer = setInterval(() => {
        if (turn < totalTurns - 1) {
          turn++;
          render();
        } else {
          clearInterval(timer);
        }
      }, ${intervalMs});
    }
    window.onload = () => {
      render();
      startReplay();
    };
  `;
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>경마 시뮬레이션 리플레이</title>
  <style>
    body { background: #f8f8f8; text-align: center; }
    #main-layout { display: flex; flex-direction: row; justify-content: center; align-items: flex-start; min-height: 100vh; height: 100vh; overflow: hidden; }
    #canvas-wrap { flex: 1 1 0; display: flex; align-items: flex-start; justify-content: center; min-width: 0; min-height: 0; position: relative; }
    #race-canvas { background: #fff; border: 2px solid #333; margin: 40px 0 0 0; display: block; box-shadow: 0 2px 8px #0002; width: 80vw; height: 70vh; max-width: 80vw; max-height: 70vh; min-width: 200px; min-height: 200px; }
    #status-panel {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 100;
      width: 260px;
      min-width: 120px;
      max-width: 95vw;
      background: rgba(255,255,255,0.97);
      border: 2px solid #888;
      border-radius: 10px;
      box-shadow: 0 4px 24px #0002;
      padding: 8px 6px;
      font-family: 'Consolas', 'monospace', 'Malgun Gothic', sans-serif;
      overflow-y: auto;
      max-height: 60vh;
      font-size: 13px;
      pointer-events: none;
      text-align: left;
    }
    #status-panel table { width: 100%; font-size: 14px; }
    #status-panel th, #status-panel td { padding: 3px 6px; border-bottom: 1px solid #eee; }
    #status-panel tr:last-child td { border-bottom: none; }
    h2 { margin-top: 32px; margin-bottom: 0; }
  </style>
</head>
<body>
  <h2>경마 리플레이</h2>
  <div id="main-layout">
    <div id="canvas-wrap">
      <canvas id="race-canvas" width="${width}" height="${height}"></canvas>
    </div>
  </div>
  <div id="status-panel"></div>
  <script>
    ${js}
  </script>
</body>
</html>
  `.trim();
  fs.writeFileSync(outPath, html, "utf-8");
  child_process.exec(`start "" "${outPath}"`);
}
