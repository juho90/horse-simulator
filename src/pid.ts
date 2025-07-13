export class PIDController {
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
