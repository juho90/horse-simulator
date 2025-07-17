import { RaceEnvironment } from "./raceEnvironment";
import { RaceHorse } from "./raceHorse";
import { HorseStateType } from "./states/horseState";

export interface Opportunities {
  canOvertake: boolean;
  canMoveInner: boolean;
  canMoveOuter: boolean;
}

export class RaceSituationAnalysis {
  racePhase: "early" | "middle" | "late" | "final";
  riskLevel: number;
  opportunities: Opportunities;
  recommendedState: HorseStateType;

  constructor(private horse: RaceHorse, private envData: RaceEnvironment) {
    this.racePhase = "early";
    this.riskLevel = 0;
    this.opportunities = {
      canOvertake: false,
      canMoveInner: false,
      canMoveOuter: false,
    };
    this.recommendedState = "maintainingPace";
  }

  update(): void {
    this.racePhase = this.determineRacePhase();
    this.riskLevel = this.calculateRiskLevel();
    this.opportunities = this.identifyOpportunities();
    this.recommendedState = this.determineRecommendedState();
  }

  private determineRacePhase(): "early" | "middle" | "late" | "final" {
    const progress = this.envData.selfStatus.raceProgress;
    if (progress < 0.25) {
      return "early";
    }
    if (progress < 0.75) {
      return "middle";
    }
    if (progress < 0.9) {
      return "late";
    }
    return "final";
  }

  private calculateRiskLevel(): number {
    let risk = 0;
    const minWallDistance = this.getMinWallDistance();
    if (minWallDistance < 20) {
      risk += ((20 - minWallDistance) / 20) * 0.5;
    }
    if (
      this.envData.nearbyHorses.front &&
      this.envData.nearbyHorses.distances[
        this.envData.nearbyHorses.front.horseId
      ] < 15
    ) {
      risk += 0.3;
    }
    const staminaRatio =
      this.envData.selfStatus.stamina / this.horse.maxStamina;
    if (staminaRatio < 0.2) {
      risk += 0.2;
    }
    return Math.min(1, risk);
  }

  private getMinWallDistance(): number {
    const raycasts = this.envData.trackInfo.raycasts;
    if (!raycasts || raycasts.length === 0) {
      return 50;
    }
    let minDistance = Infinity;
    for (const raycast of raycasts) {
      if (raycast.hitDistance < minDistance) {
        minDistance = raycast.hitDistance;
      }
    }
    return minDistance === Infinity ? 50 : minDistance;
  }

  private identifyOpportunities(): Opportunities {
    const canOvertake = !!(
      this.envData.nearbyHorses.front &&
      this.envData.nearbyHorses.distances[
        this.envData.nearbyHorses.front.horseId
      ] < 30 &&
      (!this.envData.nearbyHorses.left ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.left.horseId
        ] > 20)
    );
    const canMoveInner =
      this.envData.trackInfo.currentLane !== "inner" &&
      (!this.envData.nearbyHorses.left ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.left.horseId
        ] > 25);
    const canMoveOuter =
      this.envData.trackInfo.currentLane !== "outer" &&
      (!this.envData.nearbyHorses.right ||
        this.envData.nearbyHorses.distances[
          this.envData.nearbyHorses.right.horseId
        ] > 25);
    return { canOvertake, canMoveInner, canMoveOuter };
  }

  private determineRecommendedState(): HorseStateType {
    if (this.isEmergencySituation()) {
      return this.getEmergencyState();
    }
    const phaseBasedState = this.getPhaseBasedState();
    const staminaAdjustedState = this.adjustForStamina(phaseBasedState);
    return this.checkForOpportunities(staminaAdjustedState);
  }

  private isEmergencySituation(): boolean {
    return (
      this.riskLevel > 0.8 ||
      this.horse.stamina < 10 ||
      (this.racePhase === "final" && this.horse.stamina < 20)
    );
  }

  private getEmergencyState(): HorseStateType {
    if (this.riskLevel > 0.8) return "blocked";
    return "maintainingPace";
  }

  private getPhaseBasedState(): HorseStateType {
    switch (this.racePhase) {
      case "early":
        return "maintainingPace";
      case "middle":
        return "maintainingPace";
      case "late":
        return this.envData.selfStatus.currentRank <= 3
          ? "maintainingPace"
          : "overtaking";
      case "final":
        return "overtaking";
      default:
        return "maintainingPace";
    }
  }

  private adjustForStamina(baseState: HorseStateType): HorseStateType {
    const staminaRatio = this.horse.stamina / this.horse.maxStamina;

    if (staminaRatio < 0.3 && this.racePhase !== "final") {
      return "maintainingPace";
    }
    if (
      staminaRatio > 0.7 &&
      baseState === "maintainingPace" &&
      this.envData.selfStatus.currentRank > 5
    ) {
      return "overtaking";
    }
    return baseState;
  }

  private checkForOpportunities(currentState: HorseStateType): HorseStateType {
    if (currentState === "overtaking") {
      return currentState;
    }
    if (
      this.opportunities.canOvertake &&
      this.horse.stamina > this.horse.maxStamina * 0.4 &&
      this.racePhase !== "early"
    ) {
      return "overtaking";
    }
    return currentState;
  }
}
