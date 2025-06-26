# Horse Simulator

TypeScript로 구현된 경마 시뮬레이션 프로그램입니다. 동적으로 경마장을 생성하고, 경주마들의 경주를 시뮬레이션한 후, Canvas 기반의 리플레이를 제공합니다.

## 주요 기능

- 🏇 **경주 시뮬레이터**: 경주마의 속도(m/턴)를 기반으로 턴별 경주 진행
- 🛤 **동적 트랙 생성**: 직선(RaceLine)과 코너(RaceCorner) 세그먼트를 조합한 폐쇄형 트랙 자동 생성
- 📊 **Canvas 리플레이**: HTML5 Canvas로 경주 과정을 애니메이션으로 재생
- 🎯 **수학적 정밀도**: 정확한 기하학적 계산으로 트랙과 말의 위치 결정

## 프로젝트 구조

```
horse-simulator/
├── package.json           # 프로젝트 설정 (ts-node, typescript)
├── tsconfig.json         # TypeScript 설정
├── race-result.html      # 시뮬레이션 결과 HTML (자동 생성)
└── src/
    ├── main.ts           # 메인 엔트리포인트
    ├── raceSimulator.ts  # 경주 시뮬레이션 로직
    ├── raceTrack.ts      # 트랙 생성 및 관리
    ├── raceSegment.ts    # 트랙 세그먼트 추상 클래스
    ├── raceLine.ts       # 직선 세그먼트 구현
    ├── raceCorner.ts     # 코너 세그먼트 구현
    ├── raceViewerWebGL.ts # HTML 리플레이 생성기
    └── types/
        ├── horse.ts      # 말 인터페이스 정의
        └── raceLog.ts    # 경주 로그 타입 정의
```

## 시작하기

### 필수 조건

- Node.js 16+
- npm 또는 yarn

### 설치 및 실행

1. **의존성 설치**:

   ```bash
   npm install
   ```

2. **개발 모드 실행** (파일 변경 시 자동 재실행):

   ```bash
   npm run dev
   ```

3. **일반 실행**:

   ```bash
   npm start
   ```

4. **빌드**:
   ```bash
   npm run build
   ```

### 실행 결과

- 콘솔에 경주 결과 (우승마, 우승 턴 등) 출력
- `race-result.html` 파일 자동 생성 및 브라우저에서 리플레이 재생

## 시뮬레이션 특징

### 🐎 경주마 시스템

- **10마리 자동 생성**: Horse1~Horse10
- **속도 범위**: 18-22 m/턴 (무작위 배정)
- **확장 가능**: stamina, reaction 등 추가 속성 지원

### 🛤 트랙 생성 알고리즘

- **길이**: 1200-3600m (100m 단위 무작위)
- **세그먼트**: 3-7개 세그먼트 조합
- **패턴**: 직선과 코너가 교대로 배치
- **폐쇄형**: 시작점과 끝점이 정확히 연결
- **중앙 정렬**: 자동으로 화면 중앙에 배치

### 📊 시뮬레이션 로직

- **턴 기반**: 각 턴마다 말들이 속도만큼 이동
- **위치 추적**: 2D 좌표로 정확한 위치 계산
- **승부 판정**: 트랙 총 길이 도달 시 완주
- **데이터 로깅**: 모든 턴의 상태 기록

### 🎥 리플레이 시스템

- **Canvas 렌더링**: HTML5 Canvas 기반
- **실시간 애니메이션**: 200ms 간격 자동 재생
- **색상 구분**: 말마다 고유 색상
- **트랙 표시**: 시작점(녹색), 골인점(빨간색)

## 기술적 구현

### 객체지향 설계

```typescript
// 추상 클래스 기반 세그먼트 시스템
abstract class RaceSegment {
  abstract calculateLength(): number;
  abstract getPoints(resolution?: number): Point[];
}

class RaceLine extends RaceSegment {
  /* 직선 구현 */
}
class RaceCorner extends RaceSegment {
  /* 호 구현 */
}
```

### 수학적 알고리즘

- **트랙 생성**: 각도 정규화로 정확한 폐쇄 루프 생성
- **좌표 계산**: 삼각함수 기반 정밀한 위치 계산
- **중앙 정렬**: 바운딩 박스 계산 후 오프셋 적용

### 데이터 흐름

```
트랙 생성 → 말 생성 → 시뮬레이션 실행 → 로그 수집 → HTML 생성 → 브라우저 리플레이
```

## 확장 가능성

- **말 능력치 다양화**: 가속도, 코너링 능력, 스태미나 시스템
- **트랙 유형 확장**: 장애물, 언덕, 다양한 지형
- **UI 개선**: 실시간 관전 모드, 베팅 시스템
- **멀티플레이어**: 온라인 경주 및 순위 시스템

## 개발 환경

- **Language**: TypeScript
- **Runtime**: Node.js 16+
- **Tools**: ts-node (개발), tsc (빌드)
- **Rendering**: HTML5 Canvas

## 라이선스

MIT License
