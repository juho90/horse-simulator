import { Point, RaceSegment } from "./raceSegment";

export type CornerDirection = "left" | "right";

export class RaceCorner extends RaceSegment {
  center: Point;
  radius: number;
  angle: number; // 라디안
  direction: CornerDirection;
  startAngle: number;
  endAngle: number;

  constructor(
    start: Point,
    radius: number,
    angle: number,
    direction: CornerDirection,
    center: Point,
    startAngle?: number,
    endAngle?: number
  ) {
    const end = RaceCorner.calculateEnd(
      start,
      center,
      radius,
      angle,
      direction
    );
    super(start, end, "corner");
    this.center = center;
    this.radius = radius;
    this.angle = angle;
    this.direction = direction;
    this.startAngle =
      startAngle !== undefined
        ? startAngle
        : Math.atan2(start.y - center.y, start.x - center.x);
    this.endAngle =
      endAngle !== undefined
        ? endAngle
        : this.direction === "left"
        ? this.startAngle + angle
        : this.startAngle - angle;
    this.length = this.calculateLength();
  }

  static fromStartEndCenter(
    start: Point,
    end: Point,
    center: Point
  ): RaceCorner {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let angle = endAngle - startAngle;

    // 방향 및 보정
    let direction: CornerDirection = "left";
    if (angle < 0) {
      angle += 2 * Math.PI;
    }
    if (angle > Math.PI) {
      direction = "right";
      angle = 2 * Math.PI - angle;
    }

    const radius = Math.sqrt(
      (start.x - center.x) ** 2 + (start.y - center.y) ** 2
    );

    return new RaceCorner(
      start,
      radius,
      angle,
      direction,
      center,
      startAngle,
      endAngle
    );
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
    const delta = this.direction === "left" ? -this.angle : this.angle;
    for (let i = 0; i <= resolution; i++) {
      const theta = this.startAngle + (delta * i) / resolution;
      points.push({
        x: this.center.x + this.radius * Math.cos(theta),
        y: this.center.y + this.radius * Math.sin(theta),
      });
    }
    return points;
  }
}
