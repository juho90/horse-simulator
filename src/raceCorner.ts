import { Point, RaceSegment } from "./raceSegment";

export type CornerDirection = "left" | "right";

export class RaceCorner extends RaceSegment {
  center: Point;
  radius: number;
  angle: number; // 라디안
  direction: CornerDirection;

  constructor(
    start: Point,
    radius: number,
    angle: number,
    direction: CornerDirection,
    center?: Point
  ) {
    // center가 주어지면 end 계산, 아니면 start/angle/radius로 end 계산
    const c =
      center || RaceCorner.calculateCenter(start, radius, angle, direction);
    const end = RaceCorner.calculateEnd(start, c, radius, angle, direction);
    super(start, end, "corner");
    this.center = c;
    this.radius = radius;
    this.angle = angle;
    this.direction = direction;
    this.length = this.calculateLength();
  }

  static calculateCenter(
    start: Point,
    radius: number,
    angle: number,
    direction: CornerDirection
  ): Point {
    if (direction === "left") {
      return { x: start.x, y: start.y + radius };
    } else {
      return { x: start.x, y: start.y - radius };
    }
  }

  static calculateEnd(
    start: Point,
    center: Point,
    radius: number,
    angle: number,
    direction: CornerDirection
  ): Point {
    const dx = start.x - center.x;
    const dy = start.y - center.y;
    const startAngle = Math.atan2(dy, dx);
    const delta = direction === "left" ? angle : -angle;
    const endAngle = startAngle + delta;
    return {
      x: center.x + radius * Math.cos(endAngle),
      y: center.y + radius * Math.sin(endAngle),
    };
  }

  calculateLength(): number {
    return Math.abs(this.radius * this.angle);
  }

  getPoints(resolution: number = 100): Point[] {
    const points: Point[] = [];
    const dx = this.start.x - this.center.x;
    const dy = this.start.y - this.center.y;
    const startAngle = Math.atan2(dy, dx);
    const delta = this.direction === "left" ? this.angle : -this.angle;
    for (let i = 0; i <= resolution; i++) {
      const theta = startAngle + delta * (i / resolution);
      points.push({
        x: this.center.x + this.radius * Math.cos(theta),
        y: this.center.y + this.radius * Math.sin(theta),
      });
    }
    return points;
  }
}
