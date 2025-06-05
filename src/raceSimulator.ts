import { RaceLog, RaceStats } from "./interfaces";
import { RaceCorner } from "./raceCorner";
import { RaceHorse } from "./raceHorse";
import { RaceTrack } from "./raceTrack";
import { RacePhase } from "./raceValues";

export class RaceSimulator {
  public raceHorses: RaceHorse[];
  public corners: RaceCorner[];
  private turn = 0;
  private logs: RaceLog[] = [];
  private winner: string = "";
  private spurtStarted = false;
  private raceFinished = false;

  constructor(public track: RaceTrack, public horses: RaceHorse[]) {
    this.raceHorses = horses;
    // corners를 RaceCorner 인스턴스로 변환
    this.corners = (track.corners ?? []).map((c) => new RaceCorner(c));
  }

  public run(): RaceLog[] {
    if (this.raceFinished) {
      throw new Error(
        "이 RaceSimulator 인스턴스에서는 run()을 한 번만 호출할 수 있습니다."
      );
    }
    this.raceFinished = true;
    while (!this.isFinished()) {
      this.advanceTurn();
    }
    return this.getLogs();
  }

  advanceTurn(): void {
    if (this.isFinished()) return;
    this.turn++;
    for (const horse of this.raceHorses) {
      horse.updateRaceState({
        phase: this.getPhase(),
        track: this.track,
        horses: this.raceHorses,
      });
    }
    for (const horse of this.raceHorses) horse.tryPositioningFight(this);
    for (const horse of this.raceHorses) horse.tryOvertake(this);
    this.logs.push({ turn: this.turn, states: this.getTurnStates() });
    this.winner = this.findWinner();
  }

  getPhase(): RacePhase {
    const ratio = this.raceHorses[0].distance / this.track.finishLine;
    if (ratio < 0.3) return RacePhase.Early;
    if (ratio < 0.7) return RacePhase.Middle;
    return RacePhase.Final;
  }

  findWinner(): string {
    const finishLine = this.track.finishLine;
    for (const horse of this.raceHorses) {
      if (horse.distance >= finishLine) return horse.name;
    }
    return "";
  }

  getWinner(): string {
    return this.winner;
  }

  isFinished(): boolean {
    return this.winner !== "";
  }

  getTurnStates(): RaceStats[] {
    return this.raceHorses.map((horse) => ({
      name: horse.name,
      lane: horse.lane,
      distance: horse.distance,
      speed: horse.currentSpeed,
      accel: horse.getCurrentAcceleration(),
      staminaLeft: horse.staminaLeft,
    }));
  }

  getLogs(): RaceLog[] {
    return this.logs;
  }

  getHorses(): RaceHorse[] {
    return this.raceHorses;
  }
}
