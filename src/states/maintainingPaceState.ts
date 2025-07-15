import type { RaceHorse } from "../raceHorse";
import { LerpAngle } from "../raceMath";
import { HorseState } from "./horseState";

export class MaintainingPaceState extends HorseState {
  constructor(horse: RaceHorse) {
    super("maintainingPace", horse);
  }

  enter(): void {
    if (this.isActiveState()) {
      return;
    }
    this.isActive = true;
  }

  execute(otherHorses: RaceHorse[]): void {
    if (this.isActiveState() === false) {
      return;
    }
    const horseInFront = this.horse.findClosestHorseInFront(otherHorses);
    if (
      this.horse.canActivateState("overtaking") &&
      horseInFront &&
      this.horse.shouldAttemptOvertake(horseInFront)
    ) {
      this.horse.activateState("overtaking", { target: horseInFront });
    }
    const { moveDir, riskWeight } = this.horse.findDirOnTrack(otherHorses);
    this.horse.riskLevel = riskWeight;

    let cornerAnticipationFactor = 0;
    const LOOK_AHEAD_DISTANCE = 150;
    if (
      this.horse.farthestRaycast &&
      this.horse.farthestRaycast.hitDistance < LOOK_AHEAD_DISTANCE
    ) {
      cornerAnticipationFactor = Math.pow(
        1 - this.horse.farthestRaycast.hitDistance / LOOK_AHEAD_DISTANCE,
        2
      );
    }
    const speedReduction = Math.max(
      riskWeight * 0.5,
      cornerAnticipationFactor * 0.7
    );
    const staminaEffect = Math.max(
      0.3,
      this.horse.stamina / this.horse.maxStamina
    );
    const currentMaxSpeed = this.horse.maxSpeed * staminaEffect;
    const targetSpeed = currentMaxSpeed * (1 - speedReduction);

    // 현실적인 가속도 결정 로직
    const speedDifference = targetSpeed - this.horse.speed;
    const SPEED_TOLERANCE = 0.5;
    const speedRatio = this.horse.speed / currentMaxSpeed;

    // 위험 상황에서 가속도 감소 (벽 근처, 코너)
    const riskAccelReduction = Math.max(riskWeight, cornerAnticipationFactor);
    const safetyAccelMultiplier = Math.max(0.1, 1 - riskAccelReduction * 0.7);

    if (speedDifference > SPEED_TOLERANCE) {
      // 목표 속도보다 느림 - 가속 필요
      // 현실적인 물리: 속도가 높을수록 가속도 감소 (공기저항, 엔진 한계)
      const accelReduction = Math.pow(speedRatio, 2); // 제곱으로 더 급격한 감소
      const speedAccelMultiplier = Math.max(0.1, 1 - accelReduction * 0.8);

      // 속도 기반 감소 + 위험 상황 기반 감소를 모두 적용
      const finalAccelMultiplier = speedAccelMultiplier * safetyAccelMultiplier;
      this.horse.accel = this.horse.maxAccel * finalAccelMultiplier;
    } else if (speedDifference < -SPEED_TOLERANCE) {
      // 목표 속도보다 빠름 - 감속 필요
      // 속도 차이에 비례한 점진적 감속 (더 현실적)
      const speedExcess = Math.abs(speedDifference);
      const brakeIntensity = Math.min(
        1.0,
        speedExcess / (currentMaxSpeed * 0.3)
      ); // 최대 속도의 30% 차이에서 풀 브레이크
      this.horse.accel = -this.horse.maxAccel * brakeIntensity;
    } else {
      // 목표 속도에 거의 도달 - 현재 속도 유지 (하지만 위험 상황에서는 약간의 감속)
      if (riskAccelReduction > 0.3) {
        // 위험한 상황에서는 약간의 감속 유지
        this.horse.accel = -this.horse.maxAccel * 0.2 * riskAccelReduction;
      } else {
        this.horse.accel = 0;
      }
    }

    this.horse.raceHeading = LerpAngle(this.horse.raceHeading, moveDir, 0.4);
  }

  exit(): void {
    if (this.isActiveState() === false) {
      return;
    }
    this.isActive = false;
  }
}
