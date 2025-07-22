import { DirectionType } from "./directionalDistance";
import { DrivingMode } from "./drivingMode";
import { Lane, LaneChange } from "./laneEvaluation";
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
    const drivingModes = this.raceAnalysis.enableDrivingModes;
    const open = this.raceAnalysis.openDirections;
    const wall = this.raceAnalysis.wallDistance;
    const horseDist = this.raceAnalysis.horseDistance;
    const speed = this.horse.speed;
    const minOpenDist = Math.max(2.0, speed);
    let currentMode = DrivingMode.MaintainingPace;
    if (
      drivingModes.includes(DrivingMode.LastSpurt) &&
      this.raceEnv.raceProgress > 0.85 &&
      this.horse.stamina > this.horse.maxStamina * 0.2
    ) {
      currentMode = DrivingMode.LastSpurt;
    } else if (
      drivingModes.includes(DrivingMode.Overtaking) &&
      this.raceEnv.nearbyHorses.front &&
      horseDist.frontDistance < 10 &&
      this.horse.speed > this.horse.maxSpeed * 0.7
    ) {
      currentMode = DrivingMode.Overtaking;
    } else if (
      drivingModes.includes(DrivingMode.Positioning) &&
      (horseDist.leftDistance > 5 || horseDist.rightDistance > 5)
    ) {
      currentMode = DrivingMode.Positioning;
    } else if (drivingModes.includes(DrivingMode.Conserving)) {
      currentMode = DrivingMode.Conserving;
    }

    const trackDirection = this.horse.segment.getTangentDirectionAt(
      this.horse.x,
      this.horse.y
    );
    let targetDirection = trackDirection;
    const dirWithSource = this.raceAnalysis.dirDistanceWithSource;
    const dirList: [DirectionType, number][] = [
      [DirectionType.FRONT, dirWithSource.front.distance],
      [DirectionType.LEFT, dirWithSource.left.distance],
      [DirectionType.RIGHT, dirWithSource.right.distance],
      [DirectionType.FRONT_LEFT, dirWithSource.frontLeft.distance],
      [DirectionType.FRONT_RIGHT, dirWithSource.frontRight.distance],
    ];
    let danger = dirList.reduce((a, b) => (a[1] < b[1] ? a : b));
    let escapeDirs = dirList.filter(
      ([d, dist]) => open.includes(d) && dist >= minOpenDist
    );
    if (danger[1] < minOpenDist && escapeDirs.length > 0) {
      let best = escapeDirs.reduce((a, b) => {
        const aDiff = Math.abs(this.getDirectionAngle(a[0], trackDirection));
        const bDiff = Math.abs(this.getDirectionAngle(b[0], trackDirection));
        return aDiff < bDiff ? a : b;
      });
      targetDirection =
        this.getDirectionAngle(best[0], trackDirection) + trackDirection;
    } else if (danger[1] < minOpenDist && escapeDirs.length === 0) {
      targetDirection = trackDirection;
    }
    let headingDiff = targetDirection - this.horse.raceHeading;
    if (headingDiff > 0.12) headingDiff = 0.12;
    if (headingDiff < -0.12) headingDiff = -0.12;
    if (wall.leftDistance < 1.2 && headingDiff < 0) headingDiff = 0;
    if (wall.rightDistance < 1.2 && headingDiff > 0) headingDiff = 0;
    targetDirection = this.horse.raceHeading + headingDiff;

    let laneChange = LaneChange.Stay;
    const minLaneChangeDist = Math.max(2.0, speed * 1.2);
    const isInner = this.raceEnv.currentLane === Lane.Inner;
    const isOuter = this.raceEnv.currentLane === Lane.Outer;
    const horses = this.raceEnv.nearbyHorses;
    let preferInner = false;
    let preferOuter = false;
    if (
      open.includes(DirectionType.LEFT) &&
      !isInner &&
      !horses.left &&
      wall.leftDistance > minLaneChangeDist &&
      wall.leftDistance > 2.5 &&
      horseDist.leftDistance > minOpenDist &&
      wall.frontDistance > minOpenDist
    ) {
      preferInner = true;
    }
    if (
      open.includes(DirectionType.RIGHT) &&
      !isOuter &&
      !horses.right &&
      wall.rightDistance > minLaneChangeDist &&
      wall.rightDistance > 2.5 &&
      horseDist.rightDistance > minOpenDist &&
      wall.frontDistance > minOpenDist
    ) {
      preferOuter = true;
    }
    if (
      wall.leftDistance < 1.2 &&
      open.includes(DirectionType.RIGHT) &&
      !isOuter
    ) {
      preferOuter = true;
    }
    if (
      wall.rightDistance < 1.2 &&
      open.includes(DirectionType.LEFT) &&
      !isInner
    ) {
      preferInner = true;
    }
    if (preferInner) laneChange = LaneChange.Inner;
    else if (preferOuter) laneChange = LaneChange.Outer;

    let speedMultiplier = 0.8;
    if (currentMode === DrivingMode.LastSpurt) speedMultiplier = 1.0;
    if (currentMode === DrivingMode.Overtaking) speedMultiplier = 0.95;
    if (currentMode === DrivingMode.Positioning) speedMultiplier = 0.85;
    if (currentMode === DrivingMode.Conserving) speedMultiplier = 0.7;
    const targetSpeed = this.horse.maxSpeed * speedMultiplier;
    const targetAccel = Math.max(
      -this.horse.maxAccel,
      Math.min(this.horse.maxAccel, (targetSpeed - this.horse.speed) * 0.1)
    );
    return {
      targetSpeed,
      targetDirection,
      targetAccel,
      laneChange,
      currentMode,
    };
    // ...existing code...
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
