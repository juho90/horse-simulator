// WebGL(Three.js) 기반 경마 트랙/말 애니메이션 뷰어 (최소 예제)
// 기존 raceLog, RaceTrack 구조를 그대로 사용
// 1단계: 트랙 곡선(2D)과 말(원) 렌더링, 애니메이션 루프

import { RaceTrack } from "./raceTrack";

export function generateRaceWebGLHtml(raceLog: any[], track: RaceTrack) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>경마 WebGL 뷰어</title>
  <style>
    body { background: #222; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
    #webgl { display: block; margin: 0 auto; background: #f4f4f4; border-radius: 20px; box-shadow: 0 4px 32px #0004; }
    #controls { margin: 16px 0; }
    button { font-size: 1.2em; border-radius: 6px; border: 1px solid #888; background: #fff; color: #222; margin-right: 6px; padding: 4px 12px; }
    h1 { font-size: 2.2em; font-weight: bold; margin-bottom: 0.2em; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js"></script>
</head>
<body>
  <h1>경마 WebGL 뷰어</h1>
  <div id='controls'>
    <button onclick='prevTurn()'>◀ 이전</button>
    <span id='turnInfo'></span>
    <button onclick='nextTurn()'>다음 ▶</button>
    <button onclick='togglePlay()' id='playBtn'>▶ 재생</button>
  </div>
  <canvas id="webgl" width="900" height="500"></canvas>
  <script>
    const raceLog = ${JSON.stringify(raceLog)};
    const track = ${JSON.stringify(track)};
    let turn = 0;
    let playing = false;
    const totalTurns = raceLog.length;
    const turnInfo = document.getElementById('turnInfo');
    // Three.js 기본 세팅
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-450, 450, 250, -250, 1, 1000);
    camera.position.z = 10;
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true, alpha: true });
    renderer.setClearColor(0xf4f4f4, 1);
    // 트랙을 직선+코너 복합 곡선(2D)으로 생성
    function buildTrackCurvePath2D(track) {
      // 캔버스 크기에 맞게 중심/반지름 자동 조정
      const canvasW = 900, canvasH = 500;
      const margin = 40;
      const cx = 0;
      const cy = 0;
      const r = Math.min(canvasW, canvasH) / 2 - margin;
      let angle = 0; // 시작 각도(라디안)
      const path = new THREE.CurvePath();
      // 곡률을 더 자연스럽게: 제어점 거리를 r*1.15로 조정 (덜 뾰족하게)
      const tangentLen = r * 1.15;
      for (let i = 0; i < track.segments.length; i++) {
        const seg = track.segments[i];
        const ratio = (seg.end - seg.start) / track.trackLength;
        const segAngle = ratio * Math.PI * 2;
        if (seg.type === 'line') {
          // 직선 시작/끝점(원 위)
          const x1 = cx + Math.cos(angle) * r;
          const y1 = cy + Math.sin(angle) * r;
          const x2 = cx + Math.cos(angle + segAngle) * r;
          const y2 = cy + Math.sin(angle + segAngle) * r;
          // 직선 구간은 LineCurve로!
          path.add(new THREE.LineCurve(
            new THREE.Vector2(x1, y1),
            new THREE.Vector2(x2, y2)
          ));
          angle += segAngle;
        } else if (seg.type === 'corner') {
          path.add(new THREE.ArcCurve(
            cx, cy, r,
            angle, angle + segAngle,
            false
          ));
          angle += segAngle;
        }
      }
      if (Math.abs(angle - Math.PI * 2) > 1e-2) {
        const x1 = cx + Math.cos(angle) * r;
        const y1 = cy + Math.sin(angle) * r;
        const tanAngle = (angle + 0) / 2;
        const cpx = cx + Math.cos(tanAngle) * tangentLen;
        const cpy = cy + Math.sin(tanAngle) * tangentLen;
        const x2 = cx + Math.cos(0) * r;
        const y2 = cy + Math.sin(0) * r;
        path.add(new THREE.QuadraticBezierCurve(
          new THREE.Vector2(x1, y1),
          new THREE.Vector2(cpx, cpy),
          new THREE.Vector2(x2, y2)
        ));
      }
      return path;
    }
    // 트랙 Path
    const trackCurvePath = buildTrackCurvePath2D(track);
    const trackPoints = trackCurvePath.getPoints(300);
    const trackGeom = new THREE.BufferGeometry().setFromPoints(trackPoints.map(p => new THREE.Vector3(p.x, p.y, 0)));
    const trackLine = new THREE.Line(trackGeom, new THREE.LineBasicMaterial({ color: 0xcccccc, linewidth: 12 }));
    scene.add(trackLine);
    // 출발점/결승점 표시 (복합 곡선 길이 비율)
    function drawStartFinishMarkers() {
      const totalLen = trackCurvePath.getLength();
      const startT = track.start / track.trackLength;
      const finishT = track.finish / track.trackLength;
      const startPt = trackCurvePath.getPointAt(startT);
      const finishPt = trackCurvePath.getPointAt(finishT);
      // 출발점
      const startGeom = new THREE.PlaneGeometry(18, 36);
      const startMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const startMesh = new THREE.Mesh(startGeom, startMat);
      startMesh.position.set(startPt.x, startPt.y, 1);
      scene.add(startMesh);
      // 결승점
      const finishGeom = new THREE.PlaneGeometry(18, 36);
      const finishMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
      const finishMesh = new THREE.Mesh(finishGeom, finishMat);
      finishMesh.position.set(finishPt.x, finishPt.y, 1);
      scene.add(finishMesh);
    }
    drawStartFinishMarkers();
    // 말(원) Mesh들
    const horseMeshes = [];
    for (let i = 0; i < (raceLog[0]?.horses?.length || 0); i++) {
      const geo = new THREE.CircleGeometry(12, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0x333399 + i * 0x2222 });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      horseMeshes.push(mesh);
    }
    // 말 위치 계산 (복합 곡선 따라)
    function getHorsePos(distance, idx) {
      const t = ((track.start + distance) % track.trackLength) / track.trackLength;
      const pt = trackCurvePath.getPointAt(t);
      return { x: pt.x, y: pt.y };
    }
    // 애니메이션 루프
    function render() {
      // 말 위치 갱신
      const horses = raceLog[turn]?.horses || [];
      for (let i = 0; i < horseMeshes.length; i++) {
        const pos = getHorsePos(horses[i]?.distance || 0, i);
        horseMeshes[i].position.set(pos.x, pos.y, 0);
      }
      renderer.render(scene, camera);
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
