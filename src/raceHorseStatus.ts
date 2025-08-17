export enum RunningStyle {
  FRONT_RUNNER = "선행마",
  STALKER = "선입마",
  CLOSER = "추입마",
  VERSATILE = "자유마",
}

export class RaceHorseStatus {
  horseId: number;
  name: string;
  runningStyle: RunningStyle;
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  spirit: number;

  constructor(
    horseId: number,
    name: string,
    runningStyle: RunningStyle,
    stats: {
      strength: number;
      endurance: number;
      agility: number;
      intelligence: number;
      spirit: number;
    }
  ) {
    this.horseId = horseId;
    this.name = name;
    this.runningStyle = runningStyle;
    this.strength = stats.strength;
    this.endurance = stats.endurance;
    this.agility = stats.agility;
    this.intelligence = stats.intelligence;
    this.spirit = stats.spirit;
  }

  calculateMaxSpeed(): number {
    const baseSpeed = 18.0;
    const speedRange = 5.0;
    const strengthWeight = 0.7;
    const agilityWeight = 0.3;
    const statValue =
      (this.strength * strengthWeight + this.agility * agilityWeight) / 100;
    const maxSpeed = baseSpeed + speedRange * statValue;
    return maxSpeed;
  }

  calculateMaxAcceleration(): number {
    const baseAccel = 0.5;
    const accelRange = 0.2;
    const agilityWeight = 0.3;
    const strengthWeight = 0.2;
    const statValue =
      (this.agility * agilityWeight + this.strength * strengthWeight) / 100;
    const maxAccel = baseAccel + accelRange * statValue;
    return maxAccel;
  }

  calculateMaxStamina(): number {
    const baseStamina = 80;
    const staminaRange = 20;
    const enduranceWeight = 0.8;
    const spiritWeight = 0.2;
    const statValue =
      (this.endurance * enduranceWeight + this.spirit * spiritWeight) / 100;
    const maxStamina = baseStamina + staminaRange * statValue;
    return maxStamina;
  }

  calculateStartSpeed(): number {
    const baseStartSpeed = 8.0;
    const startSpeedRange = 4.0;
    let runningStyleModifier = 1.0;
    switch (this.runningStyle) {
      case RunningStyle.FRONT_RUNNER:
        runningStyleModifier = 1.3;
        break;
      case RunningStyle.STALKER:
        runningStyleModifier = 1.1;
        break;
      case RunningStyle.CLOSER:
        runningStyleModifier = 0.8;
        break;
      case RunningStyle.VERSATILE:
        runningStyleModifier = 1.0;
        break;
    }
    const agilityWeight = 0.3;
    const spiritWeight = 0.2;
    const statValue =
      (this.agility * agilityWeight + this.spirit * spiritWeight) / 100;
    const startSpeed =
      (baseStartSpeed + startSpeedRange * statValue) * runningStyleModifier;
    const result = Math.max(3.0, Math.min(15.0, startSpeed));
    return result;
  }

  calculateAccelerationPerTurn(timeToTop: number = 8): number {
    const maxAccel = this.calculateMaxAcceleration();
    const result = maxAccel / Math.max(1, timeToTop);
    return result;
  }
}

export function createSampleHorses(): RaceHorseStatus[] {
  return [
    new RaceHorseStatus(1, "번개", RunningStyle.FRONT_RUNNER, {
      strength: 55,
      endurance: 70,
      agility: 85,
      intelligence: 75,
      spirit: 80,
    }),
    new RaceHorseStatus(2, "지구력왕", RunningStyle.STALKER, {
      strength: 60,
      endurance: 95,
      agility: 65,
      intelligence: 85,
      spirit: 90,
    }),
    new RaceHorseStatus(3, "민첩이", RunningStyle.CLOSER, {
      strength: 70,
      endurance: 75,
      agility: 95,
      intelligence: 80,
      spirit: 70,
    }),
    new RaceHorseStatus(4, "균형잡힌", RunningStyle.VERSATILE, {
      strength: 80,
      endurance: 80,
      agility: 80,
      intelligence: 80,
      spirit: 80,
    }),
    new RaceHorseStatus(5, "천재마", RunningStyle.VERSATILE, {
      strength: 65,
      endurance: 70,
      agility: 75,
      intelligence: 95,
      spirit: 85,
    }),
    new RaceHorseStatus(6, "파워하우스", RunningStyle.FRONT_RUNNER, {
      strength: 98,
      endurance: 50,
      agility: 60,
      intelligence: 70,
      spirit: 65,
    }),
  ];
}

export function createRandomHorse(id: number, name: string): RaceHorseStatus {
  const runningStyles = [
    RunningStyle.FRONT_RUNNER,
    RunningStyle.STALKER,
    RunningStyle.CLOSER,
    RunningStyle.VERSATILE,
  ];
  const runningStyleIndex = Math.floor(Math.random() * runningStyles.length);
  const runningStyle = runningStyles[runningStyleIndex];
  return new RaceHorseStatus(id, name, runningStyle, {
    strength: Math.floor(Math.random() * 60) + 40,
    endurance: Math.floor(Math.random() * 60) + 40,
    agility: Math.floor(Math.random() * 60) + 40,
    intelligence: Math.floor(Math.random() * 60) + 40,
    spirit: Math.floor(Math.random() * 60) + 40,
  });
}

export function convertHorsesForRace(
  horses: {
    horseId: number;
    name: string;
    runningStyle: RunningStyle;
    strength: number;
    endurance: number;
    agility: number;
    intelligence: number;
    spirit: number;
  }[]
): RaceHorseStatus[] {
  const convertedHorses: RaceHorseStatus[] = new Array<RaceHorseStatus>(
    horses.length
  );
  for (let index = 0; index < horses.length; index++) {
    const horse = horses[index];
    convertedHorses[index] = new RaceHorseStatus(
      horse.horseId,
      horse.name,
      horse.runningStyle,
      {
        strength: horse.strength,
        endurance: horse.endurance,
        agility: horse.agility,
        intelligence: horse.intelligence,
        spirit: horse.spirit,
      }
    );
  }
  return convertedHorses;
}
