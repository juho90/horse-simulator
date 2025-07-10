import { RaceCorner } from "./raceCorner";
import { HorseTurnState, RaceLog } from "./raceLog";
import { RaceSegment } from "./raceSegment";
import { RaceTrack } from "./raceTrack";
import { Horse } from "./types/horse";

class RaceHorse implements Horse {
  id: number;
  name: string;
  speed: number;
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

  constructor(
    h: Horse,
    segments: RaceSegment[],
    fullGate: number,
    gate: number
  ) {
    this.id = h.id;
    this.name = h.name;
    this.speed = h.speed;
    this.stamina = h.stamina;
    this.reaction = h.reaction;
    Object.assign(this, h);
    this.segments = segments;
    this.segment = segments[0];
    this.segmentIndex = 0;
    this.gate = gate;
    const firstSegment = segments[0];
    const startDir = firstSegment.getDirection();
    const ortho = { x: -Math.sin(startDir), y: Math.cos(startDir) };
    const offset = (gate + 0.5 - fullGate / 2) * (60 / fullGate);
    this.x = firstSegment.start.x + ortho.x * offset;
    this.y = firstSegment.start.y + ortho.y * offset;
    this.heading = startDir;
    this.distance = 0;
  }

  isInsideSegment(tolerance: number): boolean {
    return this.segment.isInside(this.x, this.y, tolerance);
  }

  clampToTrackBoundary(
    x: number,
    y: number,
    tolerance: number
  ): { x: number; y: number } {
    if (this.segment.isInside(x, y, tolerance)) {
      return { x, y };
    }
    if (this.segment.type === "line") {
      const lineSegment = this.segment as RaceSegment;
      const dx = lineSegment.end.x - lineSegment.start.x;
      const dy = lineSegment.end.y - lineSegment.start.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) {
        return { x: lineSegment.start.x, y: lineSegment.start.y };
      }
      const t =
        ((x - lineSegment.start.x) * dx + (y - lineSegment.start.y) * dy) /
        len2;
      const tClamped = Math.max(0, Math.min(1, t));
      const projX = lineSegment.start.x + dx * tClamped;
      const projY = lineSegment.start.y + dy * tClamped;
      const dir = Math.atan2(dy, dx);
      return {
        x: projX - Math.sin(dir) * tolerance * 0.5,
        y: projY + Math.cos(dir) * tolerance * 0.5,
      };
    } else if (this.segment.type === "corner") {
      // 타입 안전하게 center, radius를 추출
      const cornerSegment = this.segment as RaceCorner;
      const center = cornerSegment.center;
      const radius = cornerSegment.radius;
      const angle = Math.atan2(y - center.y, x - center.x);
      const r = radius + tolerance * 0.5;
      return {
        x: center.x + r * Math.cos(angle),
        y: center.y + r * Math.sin(angle),
      };
    }
    return { x, y };
  }

  moveNextSegment() {
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segment = this.segments[this.segmentIndex];
  }

  moveOnTrack(tolerance: number): void {
    if (!this.isInsideSegment(tolerance)) {
      this.moveNextSegment();
    }
    const beginClamped = this.clampToTrackBoundary(this.x, this.y, tolerance);
    this.x = beginClamped.x;
    this.y = beginClamped.y;
    let moveDir = this.segment.getDirection();
    moveDir = this.segment.getDirectionAt(this.x, this.y);
    this.x += Math.cos(moveDir) * this.speed;
    this.y += Math.sin(moveDir) * this.speed;
    this.heading = moveDir;
    this.distance += this.speed;
  }
}

export function runRaceSimulator(
  track: RaceTrack,
  horses: Horse[],
  raceDistance?: number
): RaceLog[] {
  const tolerance = 20;
  const logs: RaceLog[] = [];
  raceDistance ??= track.totalLength;
  let turn = 0;
  const segments = track.segments || [];
  const raceHorses: RaceHorse[] = horses.map((h, i) => {
    return new RaceHorse(h, segments, horses.length, i);
  });
  while (raceHorses.some((h) => h.distance < raceDistance)) {
    const horseStates: HorseTurnState[] = new Array(raceHorses.length);
    for (let i = 0; i < raceHorses.length; i++) {
      const horse = raceHorses[i];
      if (horse.distance < raceDistance) {
        horse.moveOnTrack(tolerance);
      }
      horseStates[i] = {
        id: horse.id,
        name: horse.name,
        x: horse.x,
        y: horse.y,
        dist: horse.distance,
      };
    }
    logs.push({ turn, horseStates } as RaceLog);
    turn++;
  }
  return logs;
}
