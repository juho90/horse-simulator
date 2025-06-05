import {
  HorseOptions,
  HorseProfile,
  HorseStats,
  RunningStyle,
  TrackCorner,
  TrackOptions,
} from "./interfaces";
import { RACE_FACTORY_VALUES, RACE_SIMULATE_VALUES } from "./raceValues";

// =====================
// 트랙(경기장) 생성기
// =====================
export class RaceFactory {
  /**
   * 범위 내 랜덤값 반환 (유지보수 및 테스트 용이)
   */
  static getRandomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * 코너 시작 위치 계산 (로직 분리)
   */
  static getCornerStart(
    lastCornerEnd: number,
    minCornerLength: number,
    isLastCorner: boolean,
    finishLine: number,
    minFinalStraight: number,
    cornerCount: number,
    i: number
  ): { minStart: number; maxStart: number } {
    const minStart = lastCornerEnd + minCornerLength;
    const maxStart = isLastCorner
      ? finishLine - minFinalStraight - minCornerLength
      : finishLine - minCornerLength * (cornerCount - i);
    return { minStart, maxStart };
  }

  /**
   * 코너 길이 범위 계산 (로직 분리)
   */
  static getCornerLengthRange(
    isLastCorner: boolean,
    start: number,
    finishLine: number,
    minFinalStraight: number,
    minCornerLength: number,
    cornerCount: number,
    i: number
  ): { minLength: number; maxLength: number } {
    const { TRACK_MIN_CORNER_LENGTH, TRACK_MAX_CORNER_LENGTH } =
      RACE_FACTORY_VALUES;
    const minLength = TRACK_MIN_CORNER_LENGTH;
    const maxLength = isLastCorner
      ? Math.min(TRACK_MAX_CORNER_LENGTH, finishLine - minFinalStraight - start)
      : Math.min(
          TRACK_MAX_CORNER_LENGTH,
          finishLine - start - minCornerLength * (cornerCount - i - 1)
        );
    return { minLength, maxLength };
  }

  /**
   * 트랙의 코너 정보를 생성한다.
   */
  static generateCorners(
    finishLine: number,
    cornerCount: number,
    minCornerLength: number,
    minFinalStraight: number
  ): TrackCorner[] {
    const corners: TrackCorner[] = [];
    let lastCornerEnd = 0;
    for (let i = 0; i < cornerCount; i++) {
      const isLastCorner = i === cornerCount - 1;
      // 코너 시작 위치 계산 분리
      const { minStart, maxStart } = RaceFactory.getCornerStart(
        lastCornerEnd,
        minCornerLength,
        isLastCorner,
        finishLine,
        minFinalStraight,
        cornerCount,
        i
      );
      if (minStart >= maxStart) break;
      const start = RaceFactory.getRandomInRange(minStart, maxStart);
      // 코너 길이 범위 계산 분리
      const { minLength, maxLength } = RaceFactory.getCornerLengthRange(
        isLastCorner,
        start,
        finishLine,
        minFinalStraight,
        minCornerLength,
        cornerCount,
        i
      );
      const length = RaceFactory.getRandomInRange(minLength, maxLength);
      // 코너 병합: 이전 코너와 너무 가까우면 하나로 합침
      if (corners.length > 0) {
        const lastCorner = corners[corners.length - 1];
        if (start - lastCorner.end < minCornerLength) {
          lastCorner.end = start + length;
          lastCorner.difficulty = Math.max(
            lastCorner.difficulty,
            1 + Math.random()
          );
          lastCornerEnd = lastCorner.end;
          continue;
        }
      }
      // 새 코너 추가
      const end = start + length;
      corners.push({ start, end, difficulty: 1 + Math.random() });
      lastCornerEnd = end;
    }
    // 마지막 코너 이후 결승선까지 최소 직선 보장
    if (corners.length > 0) {
      const lastCorner = corners[corners.length - 1];
      if (finishLine - lastCorner.end < minFinalStraight) {
        lastCorner.end = finishLine - minFinalStraight;
      }
    }
    return corners;
  }

  /**
   * 스탯 키 상수 (burst → power)
   */
  static STAT_KEYS = [
    "speed",
    "stamina",
    "power",
    "paceSense",
    "cornering",
    "positioning",
  ];

  /**
   * 트랙 타입별 가중치 정의 (power 반영)
   */
  static TRACK_TYPES = [
    {
      type: "스피드형",
      weights: {
        speed: 1.3,
        stamina: 0.8,
        power: 1.1,
        paceSense: 1.0,
        cornering: 1.0,
        positioning: 1.0,
      },
    },
    {
      type: "스태미나형",
      weights: {
        speed: 0.9,
        stamina: 1.3,
        power: 1.0,
        paceSense: 1.1,
        cornering: 1.0,
        positioning: 1.0,
      },
    },
    {
      type: "밸런스형",
      weights: {
        speed: 1.0,
        stamina: 1.0,
        power: 1.0,
        paceSense: 1.0,
        cornering: 1.0,
        positioning: 1.0,
      },
    },
    {
      type: "코너형",
      weights: {
        speed: 0.95,
        stamina: 1.0,
        power: 1.0,
        paceSense: 1.0,
        cornering: 1.3,
        positioning: 1.1,
      },
    },
  ];

  /**
   * 각질별 스탯 중요도 가중치
   */
  static RUNNING_STYLE_WEIGHTS: Record<string, Record<string, number>> = {
    선행: {
      speed: 1.1, // 기존 1.2 → 1.1
      stamina: 1.0,
      power: 1.05, // 기존 1.1 → 1.05
      paceSense: 1.0,
      cornering: 0.95,
      positioning: 0.95,
    },
    선입: {
      speed: 1.05,
      stamina: 1.05,
      power: 1.0,
      paceSense: 1.15,
      cornering: 1.0,
      positioning: 1.1,
    },
    차분: {
      speed: 0.95,
      stamina: 1.15,
      power: 0.95,
      paceSense: 1.05,
      cornering: 1.1,
      positioning: 1.05,
    },
    추입: {
      speed: 1.05, // 기존 1.1 → 1.05
      stamina: 0.95,
      power: 1.1, // 기존 1.2 → 1.1
      paceSense: 0.95,
      cornering: 1.0,
      positioning: 1.0,
    },
  };

  /**
   * 트랙 가중치 생성 (간결화)
   */
  static generateTrackWeights(
    statKeys: string[],
    trackType: { weights: Record<string, number> }
  ): Record<string, number> {
    // 기본 랜덤 가중치 생성 및 타입 가중치 곱 (범위 0.9~1.1로 제한)
    const weights = Object.fromEntries(
      statKeys.map((key) => [
        key,
        (0.9 + Math.random() * 0.2) * (trackType.weights[key] ?? 1.0),
      ])
    );
    // 정규화(평균 1.0)
    const avg =
      statKeys.reduce((sum, k) => sum + weights[k], 0) / statKeys.length;
    statKeys.forEach((key) => {
      weights[key] /= avg;
    });
    return weights;
  }

  /**
   * 트랙 길이 생성 (간결화)
   */
  static generateTrackLength(): number {
    const { UNIT } = RACE_SIMULATE_VALUES;
    const { TRACK_MIN_LENGTH, TRACK_MAX_LENGTH } = RACE_FACTORY_VALUES;
    const steps = Math.floor((TRACK_MAX_LENGTH - TRACK_MIN_LENGTH) / UNIT);
    return TRACK_MIN_LENGTH + Math.floor(Math.random() * (steps + 1)) * UNIT;
  }

  /**
   * 트랙 정보 생성 (간결화)
   */
  static generateTrack(): TrackOptions {
    const statKeys = RaceFactory.STAT_KEYS;
    const trackType =
      RaceFactory.TRACK_TYPES[
        Math.floor(Math.random() * RaceFactory.TRACK_TYPES.length)
      ];
    const statWeights = RaceFactory.generateTrackWeights(statKeys, trackType);
    const finishLine = RaceFactory.generateTrackLength();
    const {
      TRACK_MIN_CORNER_COUNT,
      TRACK_MAX_CORNER_COUNT,
      TRACK_MIN_CORNER_LENGTH,
      TRACK_MIN_FINAL_STRAIGHT,
    } = RACE_FACTORY_VALUES;
    const cornerCount =
      TRACK_MIN_CORNER_COUNT +
      Math.floor(
        Math.random() * (TRACK_MAX_CORNER_COUNT - TRACK_MIN_CORNER_COUNT + 1)
      );
    const corners = RaceFactory.generateCorners(
      finishLine,
      cornerCount,
      TRACK_MIN_CORNER_LENGTH,
      TRACK_MIN_FINAL_STRAIGHT
    );
    return {
      name: `${trackType.type}-랜덤트랙-${Math.floor(Math.random() * 10000)}`,
      finishLine,
      corners,
      statWeights,
    };
  }

  static generateHorse(
    name: string,
    statWeights: Record<string, number>
  ): HorseOptions {
    const profile = RaceFactory.generateProfile(name);
    const stats = RaceFactory.generateStats(profile, statWeights);
    return { profile, stats };
  }

  static generateProfile(name: string): HorseProfile {
    // 체중: 400~600, 성격: 0.5~1.5, 각질: 랜덤
    const weight = 400 + Math.floor(Math.random() * 201);
    const temperament = 0.5 + Math.random();
    const runningStyles: RunningStyle[] = ["선행", "선입", "차분", "추입"];
    const runningStyle =
      runningStyles[Math.floor(Math.random() * runningStyles.length)];
    return { name, weight, temperament, runningStyle };
  }

  /**
   * 스탯 상충(상호배타) 제한 적용
   * - speed, power가 1100 이상이면 stamina는 900 이하로 제한
   * - stamina가 1100 이상이면 speed, power는 900 이하로 제한
   */
  static applyStatConflictLimit(
    key: string,
    base: number,
    guesses: Record<string, number>
  ): number {
    if (key === "stamina") {
      if ((guesses.speed ?? 0) > 1100 || (guesses.power ?? 0) > 1100) {
        return Math.min(base, 900);
      }
    }
    if (key === "power" || key === "speed") {
      if ((guesses.stamina ?? 0) > 1100) {
        return Math.min(base, 900);
      }
    }
    return base;
  }

  /**
   * 말의 스탯 계산 (가독성 개선: 단계별로 분리)
   */
  static calculateHorseStat(
    key: string,
    profile: HorseProfile,
    trackStatWeights: Record<string, number>
  ): number {
    let base = 800;
    // 1. 각질(런닝스타일) 영향
    const styleW =
      RaceFactory.RUNNING_STYLE_WEIGHTS[profile.runningStyle] || {};
    if (styleW[key]) base *= styleW[key];

    // 2. 체중 영향 (500 기준, ±100에 따라 ±8% 변화)
    const weightDelta = profile.weight - 500;
    if (key === "stamina") {
      // 무거울수록 stamina 증가
      const effect = 1 + weightDelta * 0.0008;
      base = base * effect;
    } else if (key === "power") {
      // 무거울수록 power 증가
      const effect = 1 + weightDelta * 0.0003; // 기존 0.0007 → 0.0003
      base = base * effect;
    } else if (key === "speed") {
      // 무거울수록 speed 감소
      const effect = 1 - weightDelta * 0.0003; // 기존 0.0007 → 0.0003
      base = base * effect;
    } else if (key === "cornering") {
      // 무거울수록 cornering 감소
      const effect = 1 - weightDelta * 0.0002; // 기존 0.0005 → 0.0002
      base = base * effect;
    }

    // 3. 성격(temperament) 영향 (1.0 기준, 0.5~1.5)
    if (key === "paceSense" || key === "positioning")
      base *= 0.9 + profile.temperament * 0.2;
    if (key === "power") base *= 0.95 + profile.temperament * 0.1;

    // 4. 트랙 가치 영향
    base *= trackStatWeights[key] || 1;

    // 5. 상충(상호배타) 제한 적용
    //   - speed, power가 1100 이상이면 stamina는 900 이하로 제한
    //   - stamina가 1100 이상이면 speed, power는 900 이하로 제한
    //   (실제 계산값을 알 수 없으므로, 추정값으로 제한)
    let guessSpeed: number;
    let guessPower: number;
    let guessStamina: number;
    if (key === "speed") {
      guessSpeed = base;
      guessPower =
        (base / (trackStatWeights["speed"] || 1)) *
        (trackStatWeights["power"] || 1) *
        (styleW["power"] || 1);
      guessStamina =
        (base / (trackStatWeights["speed"] || 1)) *
        (trackStatWeights["stamina"] || 1) *
        (styleW["stamina"] || 1);
    } else if (key === "power") {
      guessPower = base;
      guessSpeed =
        (base / (trackStatWeights["power"] || 1)) *
        (trackStatWeights["speed"] || 1) *
        (styleW["speed"] || 1);
      guessStamina =
        (base / (trackStatWeights["power"] || 1)) *
        (trackStatWeights["stamina"] || 1) *
        (styleW["stamina"] || 1);
    } else if (key === "stamina") {
      guessStamina = base;
      guessSpeed =
        (base / (trackStatWeights["stamina"] || 1)) *
        (trackStatWeights["speed"] || 1) *
        (styleW["speed"] || 1);
      guessPower =
        (base / (trackStatWeights["stamina"] || 1)) *
        (trackStatWeights["power"] || 1) *
        (styleW["power"] || 1);
    } else {
      // 기타 스탯은 모두 base로 처리
      guessSpeed = base;
      guessPower = base;
      guessStamina = base;
    }
    const guesses = {
      speed: guessSpeed,
      power: guessPower,
      stamina: guessStamina,
    };
    base = RaceFactory.applyStatConflictLimit(key, base, guesses);

    // 6. 최대/최소치 제한
    return Math.max(0, Math.min(1200, Math.round(base)));
  }

  static generateStats(
    profile: HorseProfile,
    trackStatWeights: Record<string, number>
  ): HorseStats {
    // 1. 각 스탯별 원본 값 계산 (정규화 전 상한 900 적용)
    const rawStats = Object.fromEntries(
      RaceFactory.STAT_KEYS.map((key) => [
        key,
        Math.min(
          900,
          RaceFactory.calculateHorseStat(key, profile, trackStatWeights)
        ),
      ])
    );
    // 2. 합계 구하기
    const statSum = RaceFactory.STAT_KEYS.reduce(
      (sum, key) => sum + rawStats[key],
      0
    );
    // 3. 정규화 비율 계산 (합이 4800이 되도록)
    const normalizeRatio = statSum > 0 ? 4800 / statSum : 1;
    // 4. 정규화 및 0~1200 제한
    const stats = Object.fromEntries(
      RaceFactory.STAT_KEYS.map((key) => [
        key,
        Math.max(0, Math.min(1200, Math.round(rawStats[key] * normalizeRatio))),
      ])
    );
    return {
      speed: stats["speed"],
      stamina: stats["stamina"],
      power: stats["power"],
      paceSense: stats["paceSense"],
      cornering: stats["cornering"],
      positioning: stats["positioning"],
    };
  }

  /**
   * 여러 말 이름과 트랙 가중치를 받아 HorseOptions 리스트 반환 (불필요 정보 제거)
   */
  static generateHorseList(
    horseNames: string[],
    trackStatWeights: Record<string, number>
  ): HorseOptions[] {
    return horseNames.map((name) =>
      RaceFactory.generateHorse(name, trackStatWeights)
    );
  }
}
