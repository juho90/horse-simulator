export const RACE_VALUES = {
  // 단위 및 위치 계산
  UNIT: 100, // 1 = 100 (ex: 1m = 100)
  CLOSE_POSITION_BLOCK: 1 * 100, // 블로킹 판정 거리(1m)
  CLOSE_POSITION_INNER: 3 * 100, // 인코스 진입 판정 거리(3m)

  // 스퍼트(라스트 스퍼트) 관련
  OPTIMAL_SPURT_BASE: 18 * 100, // 기본 스퍼트 시작 거리(18m)
  PACE_SENSE_BASE: 100, // 페이스센스 보정 기준값
  PACE_SENSE_STEP: 10, // 페이스센스 1단계당 거리 보정
  OPTIMAL_SPURT_PENALTY: 10 * 100, // 스퍼트 타이밍 미스 패널티(10m)

  // 게이트/코너 관련
  GATE_PENALTY_PER: 0.005, // 게이트별 패널티 비율
  CORNER_BONUS_PER: 0.01, // 코너링 보너스 비율

  // 페이즈별 속도/스태미나 소모
  EARLY_PHASE_SPEED: 0.92, // 초반 구간 속도 배율
  EARLY_PHASE_STAMINA: 0.7, // 초반 구간 스태미나 소모
  MIDDLE_PHASE_SPEED: 1.0, // 중반 구간 속도 배율
  MIDDLE_PHASE_STAMINA: 1.0, // 중반 구간 스태미나 소모
  FINAL_PHASE_STAMINA: 1.2, // 막판 구간 스태미나 소모
  FINAL_PHASE_SPURT_BONUS: 0.3, // 라스트스퍼트 속도 보너스 배율
  FINAL_PHASE_SPURT_STAMINA: 1.5, // 라스트스퍼트 스태미나 소모
  FINAL_PHASE_SPURT_STAMINA_MULT: 1.5, // 라스트스퍼트 진입 필요 스태미나 배수

  // 스태미나/체중/기질 패널티
  STAMINA_PENALTY_RATIO: 0.5, // 스태미나 패널티 임계 비율
  LOW_STAMINA_SPEED: 0.9, // 스태미나 부족 시 속도 배율
  WEIGHT_PENALTY: 0.05, // 체중 1단위당 속도 패널티
  TEMPERAMENT_VARIANCE: 0.05, // 기질 랜덤 변동 폭

  // 이동량 랜덤성
  MOVE_FACTOR_MIN: 0.95, // 이동량 최소 배율
  MOVE_FACTOR_RANGE: 0.05, // 이동량 랜덤 배율 범위

  // 랜덤값 기준
  RANDOM_BASE: 0.5, // Math.random() - RANDOM_BASE로 변동

  // 슬립스트림 관련 상수
  SLIPSTREAM_MIN_DIST: 10 * 100, // 슬립스트림 최소 거리(10m)
  SLIPSTREAM_MAX_DIST: 30 * 100, // 슬립스트림 최대 거리(30m)
  SLIPSTREAM_SPEED_BONUS: 0.5, // 슬립스트림 속도 보너스
  SLIPSTREAM_ACCEL_BONUS: 0.1, // 슬립스트림 가속 보너스

  // 코너 진입 전 포지션 싸움 거리
  POSITION_FIGHT_RANGE: 100, // 코너 진입 전 포지션 싸움 거리(m)
  POSITION_FIGHT_STAMINA: 0.1, // 포지션 싸움 시도 시 스태미나 소모량
};
