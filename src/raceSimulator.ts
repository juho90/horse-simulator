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
  lap: number = 0;
  finished: boolean = false;

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
    const TRACK_WIDTH = 40;
    let baseX = firstSegment.start.x;
    let baseY = firstSegment.start.y;
    let ortho = { x: Math.sin(startDir), y: -Math.cos(startDir) };
    const gateFrac = fullGate === 1 ? 0.5 : gate / (fullGate - 1);
    const gateOffset = gateFrac * (TRACK_WIDTH - 6);
    this.x = baseX + ortho.x * gateOffset;
    this.y = baseY + ortho.y * gateOffset;
    this.heading = startDir;
    this.distance = 0;
  }

  moveNextSegment() {
    const prevIndex = this.segmentIndex;
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segment = this.segments[this.segmentIndex];
    if (prevIndex !== 0 && this.segmentIndex === 0) {
      this.lap++;
    }
  }

  moveOnTrack(tolerance: number): void {
    if (!this.segment.isInner(this.x, this.y)) {
      const clamped = this.segment.clampToTrackBoundary(this.x, this.y);
      this.x = clamped.x;
      this.y = clamped.y;
    }
    if (this.segment.isEndAt(this.x, this.y, tolerance)) {
      this.moveNextSegment();
    }
    let moveDir = this.segment.getDirection();
    moveDir = this.segment.getDirectionAt(this.x, this.y);
    this.x += Math.cos(moveDir) * this.speed;
    this.y += Math.sin(moveDir) * this.speed;
    this.heading = moveDir;
    this.distance += this.speed;
    if (!this.segment.isInner(this.x, this.y)) {
      const clamped = this.segment.clampToTrackBoundary(this.x, this.y);
      this.x = clamped.x;
      this.y = clamped.y;
    }
  }
}

export function runRaceSimulator(
  track: RaceTrack,
  horses: Horse[],
  raceDistance?: number
): RaceLog[] {
  const tolerance = 20;
  const logs: RaceLog[] = [];
  const totalLaps = Math.ceil(
    (raceDistance ?? track.totalLength) / track.totalLength
  );
  let turn = 0;
  const segments = track.segments || [];
  const raceHorses: RaceHorse[] = horses.map((h, i) => {
    return new RaceHorse(h, segments, horses.length, i);
  });
  while (raceHorses.some((h) => !h.finished)) {
    const horseStates: HorseTurnState[] = new Array(raceHorses.length);
    for (let i = 0; i < raceHorses.length; i++) {
      const horse = raceHorses[i];
      if (!horse.finished) {
        horse.moveOnTrack(tolerance);
        if (horse.lap >= totalLaps && horse.segmentIndex === 0) {
          horse.finished = true;
        }
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
