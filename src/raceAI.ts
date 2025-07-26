import { DrivingMode, getModeSpeedMultiplier } from "./drivingMode";
import { FIRST_LANE, LAST_LANE, RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { DiffAngle } from "./raceMath";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export interface AIDecision {
  targetSpeed: number;
  targetDirection: number;
  targetAccel: number;
  targetMode: DrivingMode;
}

export class RaceAI {
  private horse: RaceHorse;
  private raceEnv: RaceEnvironment;
  private raceAnalysis: RaceSituationAnalysis;
  private currentMode: DrivingMode = DrivingMode.MaintainingPace;
  private targetLane: number;
  private aiDecision: AIDecision;

  constructor(
    horse: RaceHorse,
    raceEnvironment: RaceEnvironment,
    raceAnalysis: RaceSituationAnalysis
  ) {
    this.horse = horse;
    this.raceEnv = raceEnvironment;
    this.raceAnalysis = raceAnalysis;
    this.targetLane = LAST_LANE;
    this.aiDecision = {
      targetSpeed: horse.maxSpeed,
      targetDirection: horse.raceHeading,
      targetAccel: horse.maxAccel,
      targetMode: DrivingMode.MaintainingPace,
    };
  }

  getCurrentMode(): DrivingMode {
    return this.currentMode;
  }

  getAIDecision(): AIDecision {
    return this.aiDecision;
  }

  update(turn: number): AIDecision {
    const raceProgress = this.raceEnv.raceProgress;
    const currentRank = this.raceEnv.currentRank;
    const currentCourseLane = this.raceEnv.currentCourseLane;
    const enableDrivingModes = this.raceAnalysis.enableDrivingModes;
    const enableDirections = this.raceAnalysis.enableDirections;
    const distanceWithSources = this.raceAnalysis.distanceWithSources;
    const horseDistances = this.raceAnalysis.horseDistances;
    if (!enableDrivingModes || enableDrivingModes.length === 0)
      throw new Error("No available driving modes: AI must stop.");
    if (!enableDirections || enableDirections.length === 0)
      throw new Error("No available directions: AI must stop.");

    let selectedMode: DrivingMode;
    if (
      raceProgress > 0.7 &&
      currentRank > 1 &&
      enableDrivingModes.includes(DrivingMode.LastSpurt)
    ) {
      selectedMode = DrivingMode.LastSpurt;
    } else if (
      enableDrivingModes.includes(DrivingMode.Overtaking) &&
      Object.values(horseDistances).some((h) => h.distance < 10)
    ) {
      selectedMode = DrivingMode.Overtaking;
    } else if (
      raceProgress < 0.3 &&
      enableDrivingModes.includes(DrivingMode.Conserving)
    ) {
      selectedMode = DrivingMode.Conserving;
    } else if (
      raceProgress >= 0.3 &&
      raceProgress < 0.7 &&
      enableDrivingModes.includes(DrivingMode.Positioning)
    ) {
      selectedMode = DrivingMode.Positioning;
    } else if (enableDrivingModes.includes(DrivingMode.MaintainingPace)) {
      selectedMode = DrivingMode.MaintainingPace;
    } else {
      throw new Error("No valid driving mode.");
    }
    if (Math.abs(currentCourseLane - this.targetLane) < 0.1) {
      if (selectedMode === DrivingMode.LastSpurt) {
        const laneOptions = [1, 2, 3];
        let idx = (currentRank - 1) % laneOptions.length;
        this.targetLane = laneOptions[idx];
      } else if (selectedMode === DrivingMode.Conserving) {
        this.targetLane = FIRST_LANE;
      } else {
        this.targetLane = 3;
      }
    }
    let targetLane = currentCourseLane;
    if (currentCourseLane < this.targetLane) {
      targetLane = currentCourseLane + 1;
      if (targetLane > this.targetLane) {
        targetLane = this.targetLane;
      }
    } else if (currentCourseLane > this.targetLane) {
      targetLane = currentCourseLane - 1;
      if (targetLane < this.targetLane) {
        targetLane = this.targetLane;
      }
    }
    // 트랙 접선 방향(주행 방향)으로 이동할 때 방해물 검사
    let tangentDirectionAngle = this.horse.segment.getTangentDirectionAt(
      this.horse.x,
      this.horse.y
    );
    // 주행 방향과 가장 가까운 enableDirections 중 실제 각도 차이가 가장 작은 방향 찾기
    let mainDirectionIdx = 0;
    let minAngleDiff = Infinity;
    for (let i = 0; i < enableDirections.length; i++) {
      const dir = enableDirections[i];
      const angle = distanceWithSources[dir].angle;
      const angleDiff = Math.abs(DiffAngle(angle, tangentDirectionAngle));
      if (angleDiff < minAngleDiff) {
        minAngleDiff = angleDiff;
        mainDirectionIdx = i;
      }
    }
    const mainDir = enableDirections[mainDirectionIdx];
    const mainDist = distanceWithSources[mainDir].distance;
    // 실제 좌표 기반 경로 최적화: 트랙 중심선(또는 목표 레인 중심선) 좌표를 따라가며, 장애물 예측 회피와 곡선 주행을 반영
    let targetDirection: number;
    // 1. 트랙 중심선(또는 목표 레인 중심선) 좌표에서 다음 목표 좌표를 구함
    // (예시: 목표 레인 중심선의 다음 좌표를 구하는 함수가 있다고 가정)
    let nextTargetX =
      this.horse.x + Math.cos(tangentDirectionAngle) * this.horse.speed;
    let nextTargetY =
      this.horse.y + Math.sin(tangentDirectionAngle) * this.horse.speed;
    // 2. 장애물(말, 벽 등)의 위치와 속도를 예측하여, 충돌 가능성이 있는 방향을 제외
    // (예시: enableDirections 중 장애물까지의 거리와 각도, 장애물의 예측 위치 고려)
    let bestDirection: number | null = null;
    let minCurveCost = Infinity;
    for (let i = 0; i < enableDirections.length; i++) {
      const dir = enableDirections[i];
      const dist = distanceWithSources[dir].distance;
      if (dist < this.horse.speed) continue; // 장애물 예측 충돌 제외
      const angle = distanceWithSources[dir].angle;
      // 3. 곡선 주행: 현재 진행 방향과 선택 방향의 각도 차이가 클수록 속도 감소(회전 비용)
      const curveCost = Math.abs(DiffAngle(angle, tangentDirectionAngle));
      // 4. 목표 좌표와 선택 방향의 각도 차이(목표 접근성)
      const targetCost = Math.abs(
        DiffAngle(
          angle,
          Math.atan2(nextTargetY - this.horse.y, nextTargetX - this.horse.x)
        )
      );
      // 5. 총 비용: 곡선 비용 + 목표 접근 비용
      const totalCost = curveCost * 2 + targetCost;
      if (totalCost < minCurveCost) {
        minCurveCost = totalCost;
        bestDirection = angle;
      }
    }
    if (bestDirection === null) {
      throw new Error("No safe direction: AI must stop.");
    }
    targetDirection = bestDirection;
    let speedMultiplier = getModeSpeedMultiplier(selectedMode);
    let targetSpeed = this.horse.maxSpeed * speedMultiplier;
    let targetAccel = this.horse.maxAccel * speedMultiplier;
    const frontWallDist = distanceWithSources.front.distance;
    const frontHorseDist = horseDistances.front.distance;
    const minFrontDist = Math.min(frontWallDist, frontHorseDist);
    if (frontWallDist < 8) {
      targetSpeed = Math.min(targetSpeed, this.horse.maxSpeed * 0.2);
    } else if (minFrontDist < 15) {
      targetSpeed = Math.min(targetSpeed, this.horse.maxSpeed * 0.3);
    } else if (minFrontDist < 30) {
      targetSpeed = Math.min(targetSpeed, this.horse.maxSpeed * 0.6);
    }
    this.currentMode = selectedMode;
    this.targetLane = targetLane;
    this.aiDecision = {
      targetSpeed,
      targetDirection,
      targetAccel,
      targetMode: selectedMode,
    };
    return this.aiDecision;
  }
}
