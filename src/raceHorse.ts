import { Horse } from "./horse";
import { RaceAI } from "./raceAI";
import { RaceEnvironment } from "./raceEnvironment";
import { RaceSegment } from "./raceSegment";
import { RaceSituationAnalysis } from "./raceSituationAnalysis";

export class RaceHorse {
  horseId: number;
  name: string;
  maxSpeed: number;
  maxAccel: number;
  maxStamina: number;
  staminaConsumption: number;
  staminaRecovery: number;
  reaction: number;
  speed: number;
  accel: number;
  stamina: number;
  segments: RaceSegment[];
  segment: RaceSegment;
  segmentIndex: number;
  gate: number;
  x: number;
  y: number;
  raceHeading: number;
  raceDistance: number;
  lap: number = 0;
  finished: boolean = false;

  raceEnv: RaceEnvironment;
  raceAnalysis: RaceSituationAnalysis;
  raceAI: RaceAI;

  constructor(horse: Horse, segments: RaceSegment[], gate: number) {
    this.horseId = horse.horseId;
    this.name = horse.name;
    this.maxSpeed = horse.calculateMaxSpeed();
    this.maxAccel = horse.calculateMaxAcceleration();
    this.maxStamina = horse.calculateMaxStamina();
    this.staminaConsumption = horse.calculateStaminaConsumption();
    this.staminaRecovery = horse.calculateStaminaRecovery();
    this.reaction = horse.calculateReaction();

    this.speed = 0;
    this.accel = this.maxAccel;
    this.stamina = this.maxStamina;

    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;

    this.gate = gate;

    const gateOffset = (this.gate + 1) * 17;
    const ortho = this.segment.orthoVectorAt(
      this.segment.start.x,
      this.segment.start.y
    );
    this.x = this.segment.start.x + ortho.x * gateOffset;
    this.y = this.segment.start.y + ortho.y * gateOffset;
    const startDir = this.segment.getTangentDirectionAt(
      this.segment.start.x,
      this.segment.start.y
    );
    this.raceHeading = startDir;
    this.raceDistance = 0;

    this.raceEnv = new RaceEnvironment(this);
    this.raceAnalysis = new RaceSituationAnalysis(this, this.raceEnv);
    this.raceAI = new RaceAI(this, this.raceEnv, this.raceAnalysis);
  }

  moveNextSegment() {
    const prevIndex = this.segmentIndex;
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segment = this.segments[this.segmentIndex];
    if (prevIndex !== 0 && this.segmentIndex === 0) {
      this.lap++;
    }
  }

  moveOnTrack(turn: number, otherHorses: RaceHorse[]): void {
    this.raceEnv.update(otherHorses);
    this.raceAnalysis.update();
    const aiDecision = this.raceAI.update(turn);
    this.speed = Math.min(
      this.speed + aiDecision.targetAccel,
      aiDecision.targetSpeed
    );
    this.raceHeading = aiDecision.targetDirection;
    this.accel = aiDecision.targetAccel;
    if (this.accel > 0) {
      this.stamina -= this.staminaConsumption;
    } else if (this.speed > 0) {
      this.stamina -= this.staminaConsumption * 0.5;
    } else {
      this.stamina += this.staminaRecovery * 2;
    }
    if (this.accel < 0) {
      this.stamina += this.staminaRecovery * 0.5;
    }
    this.stamina = Math.max(0, Math.min(this.stamina, this.maxStamina));
    const staminaRatio = this.stamina / this.maxStamina;
    const staminaEffect =
      staminaRatio >= 0.5 ? 1.0 : Math.max(0.3, staminaRatio * 2);
    const currentMaxSpeed = this.maxSpeed * staminaEffect;
    this.speed = Math.max(0, Math.min(this.speed, currentMaxSpeed));
    if (
      staminaRatio > 0.6 &&
      this.speed < currentMaxSpeed * 0.85 &&
      this.accel >= 0
    ) {
      const recoveryAccel = this.maxAccel * 0.5;
      this.speed = Math.min(this.speed + recoveryAccel, currentMaxSpeed);
    }
    this.x += Math.cos(this.raceHeading) * this.speed;
    this.y += Math.sin(this.raceHeading) * this.speed;
    this.raceDistance += this.speed;
    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }

  updateEnvironment(otherHorses: RaceHorse[]): RaceEnvironment {
    this.raceEnv.update(otherHorses);
    return this.raceEnv;
  }

  updateAnalyzeSituation(): RaceSituationAnalysis {
    this.raceAnalysis.update();
    return this.raceAnalysis;
  }
}
