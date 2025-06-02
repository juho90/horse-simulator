import { TrackCorner } from "./interfaces";

export class RaceCorner {
  public start: number;
  public end: number;
  public difficulty: number;
  constructor(corner: TrackCorner) {
    this.start = corner.start;
    this.end = corner.end;
    this.difficulty = corner.difficulty;
  }

  public isInCorner(distance: number): boolean {
    return distance >= this.start && distance < this.end;
  }

  static isInCorner(distance: number, corner: RaceCorner): boolean {
    return distance >= corner.start && distance < corner.end;
  }
}
