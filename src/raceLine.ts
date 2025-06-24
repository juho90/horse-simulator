import { Point, RaceSegment } from "./raceSegment";

export class RaceLine extends RaceSegment {
  constructor(start: Point, end: Point) {
    super(start, end, "line");
  }

  calculateLength(): number {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getPoints(resolution: number = 2): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < resolution; i++) {
      const t = i / (resolution - 1);
      points.push({
        x: this.start.x + t * (this.end.x - this.start.x),
        y: this.start.y + t * (this.end.y - this.start.y),
      });
    }
    return points;
  }
}
