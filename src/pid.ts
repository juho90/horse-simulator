export class PIDController {
  private Kp: number;
  private Ki: number;
  private Kd: number;
  private tau: number;

  private limMin: number;
  private limMax: number;

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

    this.differentiator =
      (2 * this.Kd * (measurement - this.prevMeasurement) +
        (2 * this.tau - dt) * this.differentiator) /
      (2 * this.tau + dt);

    const preSatIntegral = this.integral + this.Ki * error * dt;

    let output = proportional - this.differentiator + this.integral;

    if (output > this.limMax) {
      output = this.limMax;
    } else if (output < this.limMin) {
      output = this.limMin;
    }

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
