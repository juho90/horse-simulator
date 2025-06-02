import { TrackOptions } from "./interfaces";

export class RaceRenderer {
  static renderVisualizerHtml(logs: any[], track: TrackOptions) {
    const fs = require("fs");
    const path = require("path");
    const lanesCount =
      logs.length > 0 ? Math.max(...logs[0].states.map((s: any) => s.lane)) : 1;
    const htmlTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>경마 시뮬레이터 시각화</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8f8f8; }
    .track { margin: 16px 0; background: #eee; border-radius: 8px; padding: 8px; position: relative; }
    .horse { position: absolute; transition: left 0.3s; font-size: 1.2em; font-weight: bold; white-space: nowrap; }
    .lane-label { position: absolute; left: -60px; width: 50px; text-align: right; color: #888; }
    .corner { position: absolute; top: 0; height: 100%; background: rgba(30, 144, 255, 0.18); border-radius: 6px; z-index: 0; }
    .corner-label { position: absolute; top: 2px; left: 4px; font-size: 0.95em; color: #1565c0; background: rgba(255,255,255,0.7); padding: 0 4px; border-radius: 3px; z-index: 2; pointer-events: none; }
    #controls { margin: 20px 0; }
    #turnInfo { font-size: 1.1em; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h2>🏇 경마 시뮬레이터 시각화</h2>
  <div id="controls">
    <button id="prevBtn">이전 턴</button>
    <button id="nextBtn">다음 턴</button>
    <span id="turnInfo"></span>
  </div>
  <div id="race"></div>
  <script>
    let raceLogs = __LOGS__;
    let finishLine = __FINISHLINE__;
    let lanesCount = __LANESCOUNT__;
    let corners = __CORNERS__;
    let turn = 0;
    function renderTurn(turnIdx) {
      const log = raceLogs[turnIdx];
      if (!log) return;
      document.getElementById('turnInfo').textContent = '[Turn ' + log.turn + ' / ' + raceLogs.length + ']';
      const raceDiv = document.getElementById('race');
      raceDiv.innerHTML = '';
      const trackWidth = 800;
      for (let lane = 1; lane <= lanesCount; lane++) {
        const laneDiv = document.createElement('div');
        laneDiv.className = 'track';
        laneDiv.style.height = '40px';
        laneDiv.style.position = 'relative';
        laneDiv.style.marginBottom = '8px';
        // 코너 시각화
        if (corners && corners.length > 0) {
          for (let c = 0; c < corners.length; c++) {
            const corner = corners[c];
            const left = (corner.start / finishLine * trackWidth);
            const width = ((corner.end - corner.start) / finishLine * trackWidth);
            const cornerDiv = document.createElement('div');
            cornerDiv.className = 'corner';
            cornerDiv.style.left = left + 'px';
            cornerDiv.style.width = width + 'px';
            laneDiv.appendChild(cornerDiv);
            if (corner.label) {
              const label = document.createElement('span');
              label.className = 'corner-label';
              label.style.left = (left + 4) + 'px';
              label.textContent = corner.label;
              laneDiv.appendChild(label);
            }
          }
        }
        const label = document.createElement('span');
        label.className = 'lane-label';
        label.textContent = '레인 ' + lane;
        laneDiv.appendChild(label);
        const horses = log.states.filter(function(s) { return s.lane === lane; });
        for (let i = 0; i < horses.length; i++) {
          const h = horses[i];
          const horseDiv = document.createElement('span');
          horseDiv.className = 'horse';
          horseDiv.style.left = (h.distance / finishLine * trackWidth) + 'px';
          horseDiv.style.top = (i * 18 + 5) + 'px';
          horseDiv.textContent = '🐎' + h.name;
          laneDiv.appendChild(horseDiv);
        }
        const finish = document.createElement('div');
        finish.style.position = 'absolute';
        finish.style.left = trackWidth + 'px';
        finish.style.top = '0';
        finish.style.height = '100%';
        finish.style.width = '2px';
        finish.style.background = '#f00';
        finish.style.borderRadius = '2px';
        laneDiv.appendChild(finish);
        raceDiv.appendChild(laneDiv);
      }
    }
    document.getElementById('prevBtn').onclick = function() {
      if (turn > 0) {
        turn--;
        renderTurn(turn);
      }
    };
    document.getElementById('nextBtn').onclick = function() {
      if (turn < raceLogs.length - 1) {
        turn++;
        renderTurn(turn);
      }
    };
    renderTurn(turn);
  </script>
</body>
</html>
`;
    const html = htmlTemplate
      .replace("__LOGS__", JSON.stringify(logs, null, 2))
      .replace("__FINISHLINE__", track.finishLine.toString())
      .replace("__LANESCOUNT__", lanesCount.toString())
      .replace("__CORNERS__", JSON.stringify(track.corners || []));
    const visualHtmlPath = path.join(__dirname, "raceVisualizer.html");
    fs.writeFileSync(visualHtmlPath, html, "utf-8");
    const openCmd = `start ${visualHtmlPath}`;
    require("child_process").exec(openCmd);
  }
}
