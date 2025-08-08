import * as child_process from "child_process";
import * as fs from "fs";
import { RaceCorner } from "./raceCorner";
import { LerpAngle, Vector2D } from "./raceMath";
import { RacePathfinder } from "./racePathfinder";
import { RaceTrack } from "./raceTrack";

export interface HorseTurnState {
  id: number;
  name: string;
  x: number;
  y: number;
  speed: number;
  accel: number;
  stamina: number;
  distance: number;
  pathPoints: Vector2D[] | null;
}

export interface RaceLog {
  turn: number;
  horseStates: HorseTurnState[];
}

export function generateRaceWebGLHtml(
  track: RaceTrack,
  pathfinder: RacePathfinder,
  logs: RaceLog[],
  intervalMs: number = 200
): string {
  const segments = track.segments;
  const marginX = 160;
  const marginY = 60;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  segments.forEach((seg) => {
    const b = seg.getBounds();
    if (b.minX < minX) {
      minX = b.minX;
    }
    if (b.maxX > maxX) {
      maxX = b.maxX;
    }
    if (b.minY < minY) {
      minY = b.minY;
    }
    if (b.maxY > maxY) {
      maxY = b.maxY;
    }
  });
  const trackWidth = 160;
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
  const centerLinePoints: { x: number; y: number; color: string }[] = [];
  for (const segment of segments) {
    if (segment.type === "line") {
      centerLinePoints.push({
        x: segment.start.x,
        y: segment.start.y,
        color: "#000000",
      });
    } else if (segment.type === "corner") {
      const corner = segment as RaceCorner;
      const resolution = 32;
      for (let index = 0; index <= resolution; index++) {
        const theta = LerpAngle(
          corner.startAngle,
          corner.endAngle,
          index / resolution
        );
        centerLinePoints.push({
          x: corner.center.x + corner.radius * Math.cos(theta),
          y: corner.center.y + corner.radius * Math.sin(theta),
          color: "#27ae60",
        });
      }
    }
  }
  centerLinePoints.push({
    x: segments[segments.length - 1].end.x,
    y: segments[segments.length - 1].end.y,
    color: "#000000",
  });
  const sampleNodes: { x: number; y: number }[] = [];
  const nodes = pathfinder.nodes;
  for (const prNodes of nodes.values()) {
    for (const laNodes of prNodes) {
      for (const node of laNodes) {
        sampleNodes.push({
          x: node.x - minX,
          y: node.y - minY,
        });
      }
    }
  }
  const goalPosition = track.getGoalPosition();
  const js = `
    const logs = ${JSON.stringify(logs)};
    const trackPoints = ${JSON.stringify(
      centerLinePoints.map((p) => ({
        x: p.x - minX,
        y: p.y - minY,
        color: p.color,
      }))
    )};
    const sampleNodes = ${JSON.stringify(sampleNodes)};
    const goalPosition = ${JSON.stringify({
      x: goalPosition.x - minX,
      y: goalPosition.y - minY,
    })}; 
    const horseColors = ${JSON.stringify(horseColors)};
    const canvas = document.getElementById('race-canvas');
    const ctx = canvas.getContext('2d');
    const width = ${width};
    const height = ${height};
    let turn = 0;
    let timer = null;
    let isPlaying = false;
    let playSpeed = ${intervalMs};
    const totalTurns = logs.length;
    function drawTrack() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      for (let i = 1; i < trackPoints.length; i++) {
        ctx.beginPath();
        ctx.moveTo(trackPoints[i - 1].x, trackPoints[i - 1].y);
        ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
        ctx.strokeStyle = trackPoints[i - 1].color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } 
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
      ctx.arc(goalPosition.x, goalPosition.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText('GOAL', goalPosition.x, goalPosition.y - 18); 
    }
    function drawSampleNodes() {
      ctx.save();
      ctx.fillStyle = "#009dffff";
      for (const node of sampleNodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
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
        if (horse.pathPoints) {
          horse.pathPoints.forEach((point, index) => {
            if (index > 0) {
              const prevPoint = horse.pathPoints[index - 1];
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(prevPoint.x - ${minX}, prevPoint.y - ${minY});
              ctx.lineTo(point.x - ${minX}, point.y - ${minY});
              ctx.strokeStyle = '#ff4f4fff';
              ctx.lineWidth = 2;
              ctx.globalAlpha = 0.8;
              ctx.shadowColor = '#ff4f4fff';
              ctx.shadowBlur = 5;
              ctx.stroke();
              ctx.restore();
            }
            ctx.save();
            ctx.beginPath();
            ctx.arc(point.x - ${minX}, point.y - ${minY}, 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff0000ff';
            ctx.globalAlpha = 1.0;
            ctx.shadowColor = '#ff4f4fff';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
          });
        }
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
        <tr style="background:#eee;"><th>이름</th><th>순위</th><th>속도</th><th>가속도</th><th>스태미나</th></tr>
        \${horses.map((h, i) => \`<tr><td>\${h.name}</td><td style='text-align:center;'>\${i+1}</td><td>\${h.speed.toFixed(2)}</td><td>\${h.accel.toFixed(3)}</td><td>\${h.stamina.toFixed(1)}</td></tr>\`).join('')}
      </table>\`;
    }
    function updateControls() {
      const playBtn = document.getElementById('play-btn');
      const pauseBtn = document.getElementById('pause-btn');
      const prevBtn = document.getElementById('prev-btn');
      const nextBtn = document.getElementById('next-btn');
      const turnSlider = document.getElementById('turn-slider');
      const speedSlider = document.getElementById('speed-slider');
      playBtn.disabled = isPlaying || turn >= totalTurns - 1;
      pauseBtn.disabled = !isPlaying;
      prevBtn.disabled = turn <= 0;
      nextBtn.disabled = turn >= totalTurns - 1;
      if (turnSlider) {
        turnSlider.value = turn;
        turnSlider.max = totalTurns - 1;
      }
      if (speedSlider) {
        speedSlider.value = playSpeed;
      }
      const turnInfo = document.getElementById('turn-info');
      if (turnInfo) {
        turnInfo.textContent = \`\${turn + 1} / \${totalTurns}\`;
      }
    }
    function play() {
      if (isPlaying) return;
      if (turn >= totalTurns - 1) {
        turn = 0;
      }
      isPlaying = true;
      timer = setInterval(() => {
        if (turn < totalTurns - 1) {
          turn++;
          render();
          updateControls();
        } else {
          pause();
        }
      }, playSpeed);
      updateControls();
    }
    function pause() {
      if (!isPlaying) return;
      isPlaying = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      updateControls();
    }
    function previousTurn() {
      if (turn > 0) {
        turn--;
        render();
        updateControls();
      }
    }
    function nextTurn() {
      if (turn < totalTurns - 1) {
        turn++;
        render();
        updateControls();
      }
    }
    function goToTurn(targetTurn) {
      pause();
      turn = Math.max(0, Math.min(targetTurn, totalTurns - 1));
      render();
      updateControls();
    }
    function changeSpeed(newSpeed) {
      playSpeed = parseInt(newSpeed);
      if (isPlaying) {
        pause();
        play();
      }
    }
    function render() {
      drawTrack();
      drawSampleNodes();
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
      updateControls();
      document.getElementById('play-btn').onclick = play;
      document.getElementById('pause-btn').onclick = pause;
      document.getElementById('prev-btn').onclick = previousTurn;
      document.getElementById('next-btn').onclick = nextTurn;
      document.getElementById('turn-slider').oninput = (e) => goToTurn(parseInt(e.target.value));
      document.getElementById('speed-slider').oninput = (e) => changeSpeed(e.target.value);
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); isPlaying ? pause() : play(); }
        else if (e.code === 'ArrowLeft') { e.preventDefault(); previousTurn(); }
        else if (e.code === 'ArrowRight') { e.preventDefault(); nextTurn(); }
        else if (e.code === 'Home') { e.preventDefault(); goToTurn(0); }
        else if (e.code === 'End') { e.preventDefault(); goToTurn(totalTurns - 1); }
      });
    };
  `;
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>경마 시뮬레이션 리플레이</title>
  <style>
    body { background: #f8f8f8; text-align: center; }
    #controls { margin: 10px 0; }
    #controls button { margin: 0 5px; padding: 8px 12px; font-size: 16px; border: none; border-radius: 4px; background: #3498db; color: white; cursor: pointer; }
    #controls button:disabled { background: #bdc3c7; cursor: not-allowed; }
    #controls input[type="range"] { margin: 0 10px; }
    #controls label { margin: 0 15px; }
    #turn-info { margin: 0 10px; font-weight: bold; }
    #main-layout { display: flex; flex-direction: row; justify-content: center; align-items: flex-start; }
    #canvas-wrap { flex: 1 1 0; display: flex; align-items: flex-start; justify-content: center; min-width: 0; min-height: 0; position: relative; }
    #race-canvas { background: #fff; border: 2px solid #333; margin: 40px 0 0 0; display: block; box-shadow: 0 2px 8px #0002; width: 60vmin; height: 60vmin; max-width: 60vmin; max-height: 60vmin; min-width: 200px; min-height: 200px; }
    #status-panel {
      margin: 20px auto;
      width: 80vw;
      max-width: 800px;
      background: rgba(255,255,255,0.97);
      border: 2px solid #888;
      border-radius: 10px;
      box-shadow: 0 4px 24px #0002;
      padding: 15px;
      font-family: 'Consolas', 'monospace', 'Malgun Gothic', sans-serif;
      font-size: 14px;
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
  <div id="controls">
    <button id="play-btn">▶</button>
    <button id="pause-btn">⏸</button>
    <button id="prev-btn">⏮</button>
    <button id="next-btn">⏭</button>
    <span id="turn-info">1 / 1</span>
    <input type="range" id="turn-slider" min="0" max="0" value="0">
    <label>속도: <input type="range" id="speed-slider" min="50" max="1000" value="200"></label>
  </div>
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
}

export function testRaceWebGL(outPath: string, htmlString: string) {
  fs.writeFileSync(outPath, htmlString, "utf-8");
  child_process.exec(`start "" "${outPath}"`);
}
