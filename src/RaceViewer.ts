// raceViewer.ts
// logs 배열을 넣으면 실제 경주 애니메이션이 동작하는 HTML을 반환

export function getRaceViewerHtml(logs: any[]): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>경주 애니메이션</title>
  <style>
    body { font-family: sans-serif; }
    .track { margin: 10px 0; height: 32px; position: relative; background: #eee; border-radius: 16px; }
    .horse {
      position: absolute;
      top: 0; left: 0;
      width: 32px; height: 32px;
      text-align: center;
      line-height: 32px;
      font-size: 24px;
      transition: left 0.3s;
    }
    .winner { color: gold; font-weight: bold; }
    #controls { margin: 16px 0; }
  </style>
</head>
<body>
  <h1>경마 시뮬레이터 애니메이션</h1>
  <div id="race"></div>
  <div id="result"></div>
  <div id="controls"></div>
  <script>
    const logs = ${JSON.stringify(logs, null, 2)};
    let turn = 0;
    let interval = null;
    const trackLength = 600; // px
    function render() {
      const raceDiv = document.getElementById('race');
      const resultDiv = document.getElementById('result');
      raceDiv.innerHTML = '';
      const horses = logs[turn];
      horses.forEach((horse, idx) => {
        const trackElem = document.createElement('div');
        trackElem.className = 'track';
        trackElem.style.width = trackLength + 'px';
        // 말 위치 계산
        const left = Math.min(trackLength - 40, Math.floor((horse.position / 100) * (trackLength - 40)));
        const horseElem = document.createElement('div');
        horseElem.className = 'horse';
        horseElem.style.left = left + 'px';
        horseElem.textContent = '🐎 ' + horse.name;
        if (horse.position >= 100) horseElem.classList.add('winner');
        trackElem.appendChild(horseElem);
        raceDiv.appendChild(trackElem);
      });
      // 우승자 표시
      const winner = horses.find(h => h.position >= 100);
      resultDiv.innerHTML = winner ? '<span class="winner">우승: ' + winner.name + '</span>' : '';
    }
    function play() {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        turn++;
        if (turn >= logs.length) {
          clearInterval(interval);
        } else {
          render();
        }
      }, 400);
    }
    function pause() {
      if (interval) clearInterval(interval);
    }
    function prev() {
      pause();
      if (turn > 0) { turn--; render(); }
    }
    function next() {
      pause();
      if (turn < logs.length - 1) { turn++; render(); }
    }
    function setupControls() {
      const controls = document.getElementById('controls');
      controls.innerHTML = 
        '<button onclick="prev()">이전</button>' +
        '<button onclick="play()">재생</button>' +
        '<button onclick="pause()">일시정지</button>' +
        '<button onclick="next()">다음</button>';
    }
    window.prev = prev;
    window.play = play;
    window.pause = pause;
    window.next = next;
    render();
    setupControls();
    play(); // index.html을 열면 바로 재생
  </script>
</body>
</html>`;
}
