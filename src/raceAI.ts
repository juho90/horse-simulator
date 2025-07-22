import { DirectionType } from "./directionalDistance";
import { DrivingMode } from "./drivingMode";
import { LaneChange } from "./laneEvaluation";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  laneChange: LaneChange;
  currentMode: DrivingMode;
}

export class RaceAI {
  private horse: RaceHorse;
  private raceEnv: RaceEnvironment;
  private raceAnalysis: RaceSituationAnalysis;
  private currentMode: DrivingMode = DrivingMode.MaintainingPace;
  private aiDecision: AIDecision;

  constructor(
    horse: RaceHorse,
    raceEnvironment: RaceEnvironment,
    raceAnalysis: RaceSituationAnalysis
  ) {
    this.horse = horse;
    this.raceEnv = raceEnvironment;
    this.raceAnalysis = raceAnalysis;
    this.aiDecision = {
      targetSpeed: horse.maxSpeed,
      targetDirection: horse.raceHeading,
      targetAccel: horse.maxAccel,
      laneChange: LaneChange.Stay,
      currentMode: DrivingMode.MaintainingPace,
    };
  }

  update(turn: number): AIDecision {
    this.aiDecision = this.makeDecision();
    this.currentMode = this.aiDecision.currentMode;
    return this.aiDecision;
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDecision(): AIDecision {
    return this.aiDecision;
  }

  private makeDecision(): AIDecision {
    const open = this.raceAnalysis.openDirections;
    const wall = this.raceAnalysis.wallDistance;
    const horseDist = this.raceAnalysis.horseDistance;
    const dirWithSource = this.raceAnalysis.dirDistanceWithSource;
    const speed = this.horse.speed;
    // 각도 0~2π 보정 함수
    const normalize = (a: number) =>
      ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // 트랙 진행방향(최적 라인)
    const trackDirection = this.horse.segment.getTangentDirectionAt(
      this.horse.x,
      this.horse.y
    );
    // openDirections(거리 > speed)만 후보
    const allDirs: DirectionType[] = [
      DirectionType.FRONT,
      DirectionType.LEFT,
      DirectionType.RIGHT,
      DirectionType.FRONT_LEFT,
      DirectionType.FRONT_RIGHT,
    ];
    // 정면 벽이 가까우면 FRONT 후보 제외
    const openDirs = allDirs.filter((dir) => {
      if (!open.includes(dir)) return false;
      if (dir === DirectionType.FRONT && wall.frontDistance <= speed)
        return false;
      return true;
    });
    // 각 후보 방향별 위험 체크(벽/말과의 거리)
    const safeDirs = openDirs.filter((dir) => {
      const wallDist = (() => {
        if (dir === DirectionType.FRONT) return wall.frontDistance;
        if (dir === DirectionType.LEFT) return wall.leftDistance;
        if (dir === DirectionType.RIGHT) return wall.rightDistance;
        if (dir === DirectionType.FRONT_LEFT)
          return Math.min(wall.frontDistance, wall.leftDistance);
        if (dir === DirectionType.FRONT_RIGHT)
          return Math.min(wall.frontDistance, wall.rightDistance);
        return Infinity;
      })();
      const horseDistVal = (() => {
        if (dir === DirectionType.FRONT) return horseDist.frontDistance;
        if (dir === DirectionType.LEFT) return horseDist.leftDistance;
        if (dir === DirectionType.RIGHT) return horseDist.rightDistance;
        if (dir === DirectionType.FRONT_LEFT)
          return Math.min(horseDist.frontDistance, horseDist.leftDistance);
        if (dir === DirectionType.FRONT_RIGHT)
          return Math.min(horseDist.frontDistance, horseDist.rightDistance);
        return Infinity;
      })();
      // 벽/말과의 거리 모두 speed 이상이어야 안전
      return wallDist > speed && horseDistVal > speed;
    });
    // 모든 방향이 막히면 즉시 정지
    if (safeDirs.length === 0) {
      return {
        targetSpeed: 0,
        targetDirection: this.horse.raceHeading,
        targetAccel: -this.horse.maxAccel,
        laneChange: LaneChange.Stay,
        currentMode: DrivingMode.MaintainingPace,
      };
    }
    // 트랙 진행방향과 각도 차이가 가장 작은 방향 선택(최단거리)
    let bestDir = safeDirs[0];
    let minDiff = Math.abs(
      normalize(this.getDirectionAngle(safeDirs[0], trackDirection))
    );
    for (const dir of safeDirs) {
      const diff = Math.abs(
        normalize(this.getDirectionAngle(dir, trackDirection))
      );
      if (diff < minDiff) {
        bestDir = dir;
        minDiff = diff;
      }
    }
    const bestDirAngle = normalize(
      this.getDirectionAngle(bestDir, trackDirection) + trackDirection
    );
    // 속도/가속 결정: 위험 없으면 최대, 위험 있으면 감속
    let targetSpeed = this.horse.maxSpeed;
    let targetAccel = Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, (targetSpeed - this.horse.speed) * 0.1)
    );
    // 벽/말과의 거리 여유가 적으면 감속
    const bestWallDist = (() => {
      if (bestDir === DirectionType.FRONT) return wall.frontDistance;
      if (bestDir === DirectionType.LEFT) return wall.leftDistance;
      if (bestDir === DirectionType.RIGHT) return wall.rightDistance;
      if (bestDir === DirectionType.FRONT_LEFT)
        return Math.min(wall.frontDistance, wall.leftDistance);
      if (bestDir === DirectionType.FRONT_RIGHT)
        return Math.min(wall.frontDistance, wall.rightDistance);
      return Infinity;
    })();
    const bestHorseDist = (() => {
      if (bestDir === DirectionType.FRONT) return horseDist.frontDistance;
      if (bestDir === DirectionType.LEFT) return horseDist.leftDistance;
      if (bestDir === DirectionType.RIGHT) return horseDist.rightDistance;
      if (bestDir === DirectionType.FRONT_LEFT)
        return Math.min(horseDist.frontDistance, horseDist.leftDistance);
      if (bestDir === DirectionType.FRONT_RIGHT)
        return Math.min(horseDist.frontDistance, horseDist.rightDistance);
      return Infinity;
    })();
    if (bestWallDist < speed * 2 || bestHorseDist < speed * 2) {
      targetSpeed = Math.min(targetSpeed, this.horse.speed * 0.7);
      targetAccel = -Math.abs(this.horse.maxAccel * 0.5);
    }
    // 차선 변경: openDirections에 포함되고, 벽/말과의 거리 여유가 충분할 때만
    let laneChange = LaneChange.Stay;
    if (bestDir === DirectionType.LEFT) laneChange = LaneChange.Inner;
    if (bestDir === DirectionType.RIGHT) laneChange = LaneChange.Outer;
    return {
      targetSpeed,
      targetDirection: bestDirAngle,
      targetAccel,
      laneChange,
      currentMode: DrivingMode.MaintainingPace,
    };
  }
  private getDirectionAngle(dir: DirectionType, track: number): number {
    if (dir === DirectionType.FRONT) return 0;
    if (dir === DirectionType.LEFT) return -Math.PI / 2;
    if (dir === DirectionType.RIGHT) return Math.PI / 2;
    if (dir === DirectionType.FRONT_LEFT) return -Math.PI / 4;
    if (dir === DirectionType.FRONT_RIGHT) return Math.PI / 4;
    return 0;
  }
}
