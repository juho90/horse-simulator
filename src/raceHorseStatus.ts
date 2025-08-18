export class RaceHorseStatus {
  horseId: number;
  name: string;
  runningStyle: "FRONT_RUNNER" | "STALKER" | "CLOSER" | "VERSATILE";
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  spirit: number;

  constructor(
    horseId: number,
    name: string,
    runningStyle: "FRONT_RUNNER" | "STALKER" | "CLOSER" | "VERSATILE",
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

  calculateStartAccel(): number {
    const baseStartAccel = 0.2;
    const startAccelRange = 0.2;
    let runningStyleModifier = 1.0;
    switch (this.runningStyle) {
      case "FRONT_RUNNER":
        runningStyleModifier = 1.3;
        break;
      case "STALKER":
        runningStyleModifier = 1.1;
        break;
      case "CLOSER":
        runningStyleModifier = 0.8;
        break;
      case "VERSATILE":
        runningStyleModifier = 1.0;
        break;
    }
    const agilityWeight = 0.3;
    const spiritWeight = 0.2;
    const statValue =
      (this.agility * agilityWeight + this.spirit * spiritWeight) / 100;
    const startAccel =
      (baseStartAccel + startAccelRange * statValue) * runningStyleModifier;
    return startAccel;
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

  calculateLastSpurtSpeed(): number {
    const maxSpeed = this.calculateMaxSpeed();
    let runningStyleModifier = 1.0;
    switch (this.runningStyle) {
      case "FRONT_RUNNER":
        runningStyleModifier = 1.1;
        break;
      case "STALKER":
        runningStyleModifier = 1.3;
        break;
      case "CLOSER":
        runningStyleModifier = 1.5;
        break;
      case "VERSATILE":
        runningStyleModifier = 1.1;
        break;
    }
    return maxSpeed * runningStyleModifier;
  }

  calculateLastSpurtAccel(): number {
    const maxAccel = this.calculateStartAccel();
    let runningStyleModifier = 1.0;
    switch (this.runningStyle) {
      case "FRONT_RUNNER":
        runningStyleModifier = 0.05;
        break;
      case "STALKER":
        runningStyleModifier = 0.08;
        break;
      case "CLOSER":
        runningStyleModifier = 0.11;
        break;
      case "VERSATILE":
        runningStyleModifier = 0.05;
        break;
    }
    return maxAccel + runningStyleModifier;
  }
}

export function createSampleHorses(): RaceHorseStatus[] {
  return [
    new RaceHorseStatus(1, "번개", "FRONT_RUNNER", {
      strength: 75,
      endurance: 70,
      agility: 85,
      intelligence: 75,
      spirit: 80,
    }),
    new RaceHorseStatus(2, "지구력왕", "STALKER", {
      strength: 80,
      endurance: 95,
      agility: 85,
      intelligence: 85,
      spirit: 90,
    }),
    new RaceHorseStatus(3, "민첩이", "CLOSER", {
      strength: 70,
      endurance: 75,
      agility: 95,
      intelligence: 80,
      spirit: 70,
    }),
    new RaceHorseStatus(4, "균형잡힌", "VERSATILE", {
      strength: 80,
      endurance: 80,
      agility: 80,
      intelligence: 80,
      spirit: 80,
    }),
    new RaceHorseStatus(5, "천재마", "VERSATILE", {
      strength: 85,
      endurance: 70,
      agility: 75,
      intelligence: 95,
      spirit: 85,
    }),
    new RaceHorseStatus(6, "파워하우스", "FRONT_RUNNER", {
      strength: 98,
      endurance: 70,
      agility: 80,
      intelligence: 70,
      spirit: 85,
    }),
  ];
}

export function createRandomHorse(id: number, name: string): RaceHorseStatus {
  const runningStyles: Array<RaceHorseStatus["runningStyle"]> = [
    "FRONT_RUNNER",
    "STALKER",
    "CLOSER",
    "VERSATILE",
  ];
  const runningStyleIndex = Math.floor(Math.random() * runningStyles.length);
  const runningStyle = runningStyles[runningStyleIndex];
  return new RaceHorseStatus(id, name, runningStyle, {
    strength: Math.floor(Math.random() * 30) + 70,
    endurance: Math.floor(Math.random() * 30) + 70,
    agility: Math.floor(Math.random() * 30) + 70,
    intelligence: Math.floor(Math.random() * 30) + 70,
    spirit: Math.floor(Math.random() * 30) + 70,
  });
}

export function convertHorsesForRace(
  horses: {
    horseId: number;
    name: string;
    runningStyle: "FRONT_RUNNER" | "STALKER" | "CLOSER" | "VERSATILE";
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
