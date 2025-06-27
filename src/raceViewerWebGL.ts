import * as child_process from "child_process";
import * as fs from "fs";
import { HorseTurnState } from "./raceLog";
import { RaceTrack } from "./raceTrack";

export function generateRaceWebGLHtml(
  outPath: string,
  logs: HorseTurnState[],
  track: RaceTrack,
  intervalMs: number = 200
) {
  const points = track.getTrackPoints(
    Math.max(1000, Math.round(track.totalLength))
  );
  const margin = 40;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = maxX - minX + margin * 2;
  const height = maxY - minY + margin * 2;
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
      x: p.x - minX + margin,
      y: p.y - minY + margin,
    };
  }
  const js = `
    const logs = ${JSON.stringify(logs)};
    const trackPoints = ${JSON.stringify(points.map(toCanvas))};
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
      if (!logs[turnIdx]) return;
      logs[turnIdx].horses.forEach((horse, idx) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(horse.x - ${minX} + ${margin}, horse.y - ${minY} + ${margin}, 10, 0, 2 * Math.PI);
        ctx.fillStyle = horseColors[idx % horseColors.length];
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((idx+1).toString(), horse.x - ${minX} + ${margin}, horse.y - ${minY} + ${margin});
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
    function render() {
      drawTrack();
      drawHorses(turn);
      drawTurnInfo(turn);
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
    #race-canvas { background: #fff; border: 2px solid #333; margin: 30px auto; display: block; }
  </style>
</head>
<body>
  <h2>경마 리플레이</h2>
  <canvas id="race-canvas" width="${width}" height="${height}"></canvas>
  <script>
    ${js}
  </script>
</body>
</html>
  `.trim();
  fs.writeFileSync(outPath, html, "utf-8");
  child_process.exec(`start "" "${outPath}"`);
}
