import { RaceSegment } from "./raceSegment";

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}
import { raycastBoundary, RaycastResult } from "./raceSimulator";
import { Horse } from "./types/horse";

const TRACK_WIDTH = 80;

class PIDController {
  private Kp: number; // Proportional gain
  private Ki: number; // Integral gain
  private Kd: number; // Derivative gain
  private tau: number; // Derivative low-pass filter time constant

  private limMin: number; // Output limit min
  private limMax: number; // Output limit max

  private integral: number = 0;
  private prevError: number = 0;
  private differentiator: number = 0;
  private prevMeasurement: number = 0;

  constructor(
    Kp: number,
    Ki: number,
    Kd: number,
    tau: number,
    limMin: number,
    limMax: number
  ) {
    this.Kp = Kp;
    this.Ki = Ki;
    this.Kd = Kd;
    this.tau = tau;
    this.limMin = limMin;
    this.limMax = limMax;
  }

  update(setpoint: number, measurement: number, dt: number): number {
    const error = setpoint - measurement;

    const proportional = this.Kp * error;

    // Derivative on measurement with low-pass filter
    this.differentiator =
      (2 * this.Kd * (measurement - this.prevMeasurement) +
        (2 * this.tau - dt) * this.differentiator) /
      (2 * this.tau + dt);

    const preSatIntegral = this.integral + this.Ki * error * dt;

    // PID output with integral anti-windup
    let output = proportional - this.differentiator + this.integral;

    // Clamp output
    if (output > this.limMax) {
      output = this.limMax;
    } else if (output < this.limMin) {
      output = this.limMin;
    }

    // Anti-windup
    if (this.Ki !== 0) {
      const antiWindup =
        0.1 * (output - (proportional - this.differentiator + preSatIntegral));
      this.integral = preSatIntegral + antiWindup;
    }

    this.prevError = error;
    this.prevMeasurement = measurement;

    return output;
  }

  reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.differentiator = 0;
    this.prevMeasurement = 0;
  }
}

export class RaceHorse implements Horse {
  id: number;
  name: string;
  speed: number;
  acceleration: number;
  maxAcceleration: number;
  maxSpeed: number;
  stamina?: number;
  reaction?: number;
  segments: RaceSegment[];
  segment: RaceSegment;
  segmentIndex: number;
  gate: number;
  x: number;
  y: number;
  heading: number;
  distance: number;
  lap: number = 0;
  riskLevel: number = 0;
  finished: boolean = false;
  private pidController: PIDController;

  constructor(horse: Horse, segments: RaceSegment[], gate: number) {
    this.id = horse.id;
    this.name = horse.name;
    this.speed = 0;
    this.acceleration = 0.2;
    this.maxAcceleration = 0.2;
    this.maxSpeed = horse.speed;
    this.stamina = horse.stamina;
    this.reaction = horse.reaction;
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const firstSegment = segments[0];
    const startDir = firstSegment.getEndTangentDirection();
    let baseX = firstSegment.start.x;
    let baseY = firstSegment.start.y;
    let ortho = firstSegment.orthoVectorAt(baseX, baseY);
    const gateOffset = 5 + gate * 5;
    this.x = baseX + ortho.x * gateOffset;
    this.y = baseY + ortho.y * gateOffset;
    this.heading = startDir;
    this.distance = 0;
    // Kp, Ki, Kd, tau (filter), limMin, limMax
    this.pidController = new PIDController(
      0.8,
      0.2,
      0.1,
      0.1,
      -Math.PI / 4,
      Math.PI / 4
    );
  }

  moveNextSegment() {
    const prevIndex = this.segmentIndex;
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segment = this.segments[this.segmentIndex];
    if (prevIndex !== 0 && this.segmentIndex === 0) {
      this.lap++;
    }
  }

  static lerpAngle(a: number, b: number, t: number): number {
    const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + diff * t;
  }

  closestRaycasts: RaycastResult[] | null = null;
  farthestRaycast: RaycastResult | null = null;

  findDirOnTrack(): { moveDir: number; riskWeight: number } {
    const nextSegmentIndex = (this.segmentIndex + 1) % this.segments.length;
    const nextSegment = this.segments[nextSegmentIndex];
    const { closestRaycasts, farthestRaycast } = raycastBoundary(
      this.x,
      this.y,
      this.heading,
      this.segment,
      nextSegment,
      TRACK_WIDTH
    );
    this.closestRaycasts = closestRaycasts;
    this.farthestRaycast = farthestRaycast;
    return this.findDirOnTrackWithRays(closestRaycasts, farthestRaycast);
  }

  findDirOnTrackWithRays(
    closestRaycasts: RaycastResult[],
    farthestRaycast: RaycastResult | null
  ): { moveDir: number; riskWeight: number } {
    if (this.speed <= 0) {
      return { moveDir: this.heading, riskWeight: 0 };
    }

    const courseAngle = this.segment.getTangentDirectionAt(this.x, this.y);

    if (!closestRaycasts || closestRaycasts.length === 0) {
      return { moveDir: courseAngle, riskWeight: 0 };
    }

    // --- Repulsion Force Model ---
    let avoidanceVector = { x: 0, y: 0 };
    let minDistance = Infinity;

    for (const ray of closestRaycasts) {
      minDistance = Math.min(minDistance, ray.hitDistance);
      if (ray.hitDistance > 0) {
        // Force is inversely proportional to the square of the distance
        const forceMagnitude = 1 / (ray.hitDistance * ray.hitDistance);
        // Vector from hit point pointing away from the wall (towards the horse)
        const forceAngle = ray.angle + Math.PI;
        avoidanceVector.x += Math.cos(forceAngle) * forceMagnitude;
        avoidanceVector.y += Math.sin(forceAngle) * forceMagnitude;
      }
    }

    // --- Risk Calculation (based on proximity) ---
    const RISK_DISTANCE = 20.0;
    let riskWeight = 0;
    if (minDistance < RISK_DISTANCE) {
        riskWeight = Math.pow(1 - minDistance / RISK_DISTANCE, 2);
    }

    // --- Goal Vector (Dynamically Adjusted) ---
    // The desire to follow the track tangent increases as risk increases
    const baseGoalForce = 0.01;
    const maxGoalForce = 0.1;
    const goalForce = baseGoalForce + (maxGoalForce - baseGoalForce) * riskWeight;
    const goalVector = {
      x: Math.cos(courseAngle) * goalForce,
      y: Math.sin(courseAngle) * goalForce,
    };

    // --- Combine Vectors ---
    const finalVector = {
      x: goalVector.x + avoidanceVector.x,
      y: goalVector.y + avoidanceVector.y,
    };

    const bestDir = Math.atan2(finalVector.y, finalVector.x);

    return { moveDir: bestDir, riskWeight };
  }

  moveOnTrack(): void {
    const { moveDir, riskWeight } = this.findDirOnTrack();
    this.riskLevel = riskWeight;

    // --- Intelligent Speed Control based on Corner Anticipation ---
    let cornerAnticipationFactor = 0;
    const LOOK_AHEAD_DISTANCE = 150; // How far ahead to check for corners

    if (this.farthestRaycast && this.farthestRaycast.hitDistance < LOOK_AHEAD_DISTANCE) {
      // Approaching a corner, calculate how much to slow down
      cornerAnticipationFactor = Math.pow(1 - this.farthestRaycast.hitDistance / LOOK_AHEAD_DISTANCE, 2);
    }

    // Adjust speed based on lateral risk and upcoming corners
    // Slow down more for corners than for just being near a side wall
    const speedReduction = Math.max(riskWeight * 0.5, cornerAnticipationFactor * 0.7);
    const targetSpeed = this.maxSpeed * (1 - speedReduction);

    // --- Collision Prediction & Emergency Braking ---
    const TTC_THRESHOLD = 2.0; // Time to Collision threshold in seconds
    let collisionImminent = false;
    if (this.speed > 1 && this.farthestRaycast) {
        const timeToCollision = this.farthestRaycast.hitDistance / this.speed;
        if (timeToCollision < TTC_THRESHOLD) {
            collisionImminent = true;
        }
    }

    if (collisionImminent) {
        // Emergency brake overrides other calculations
        this.acceleration = -this.maxAcceleration;
    } else if (this.speed > targetSpeed) {
        this.acceleration = -this.maxAcceleration;
    } else {
        this.acceleration = this.maxAcceleration;
    }

    this.speed += this.acceleration;
    this.speed = Math.max(0, Math.min(this.speed, this.maxSpeed));

    // Smoothly update heading towards the target direction
    this.heading = RaceHorse.lerpAngle(this.heading, moveDir, 0.4);

    this.x += Math.cos(this.heading) * this.speed;
    this.y += Math.sin(this.heading) * this.speed;
    this.distance += this.speed;

    if (this.segment.isEndAt(this.x, this.y)) {
      this.moveNextSegment();
    }
  }
}
