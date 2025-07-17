export class Horse {
  horseId: number;
  name: string;
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  spirit: number;

  constructor(
    horseId: number,
    name: string,
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
    return baseSpeed + speedRange * statValue;
  }

  calculateMaxAcceleration(): number {
    const baseAccel = 3.5;
    const accelRange = 0.5;
    const agilityWeight = 0.8;
    const strengthWeight = 0.2;
    const statValue =
      (this.agility * agilityWeight + this.strength * strengthWeight) / 100;
    return baseAccel + accelRange * statValue;
  }

  calculateMaxStamina(): number {
    const baseStamina = 80;
    const staminaRange = 20;
    const enduranceWeight = 0.8;
    const spiritWeight = 0.2;
    const statValue =
      (this.endurance * enduranceWeight + this.spirit * spiritWeight) / 100;
    return baseStamina + staminaRange * statValue;
  }

  calculateReaction(): number {
    const baseReaction = 1.0;
    const reactionRange = 0.7;
    const intelligenceWeight = 0.6;
    const agilityWeight = 0.4;
    const statValue =
      (this.intelligence * intelligenceWeight + this.agility * agilityWeight) /
      100;
    return baseReaction - reactionRange * statValue;
  }

  calculateStaminaConsumption(): number {
    const baseConsumption = 0.1;
    const enduranceEffect = 0.5 + (this.endurance / 100) * 1.0;
    return baseConsumption / enduranceEffect;
  }

  calculateStaminaRecovery(): number {
    const baseRecovery = 0.05;
    const spiritEffect = 0.5 + (this.spirit / 100) * 1.5;
    return baseRecovery * spiritEffect;
  }
}

export function createSampleHorses(): Horse[] {
  return [
    new Horse(1, "번개", {
      strength: 95, // 매우 높은 힘 - 최고속도 우수
      endurance: 70, // 평균 지구력 - 보통 스태미나
      agility: 85, // 높은 민첩성 - 빠른 가속과 코너링
      intelligence: 75, // 평균 이상 지능 - 좋은 판단력
      spirit: 80, // 높은 정신력 - 압박상황 잘 견딤
    }),
    new Horse(2, "지구력왕", {
      strength: 60, // 보통 힘 - 평균적 최고속도
      endurance: 95, // 매우 높은 지구력 - 뛰어난 스태미나
      agility: 65, // 평균 민첩성
      intelligence: 85, // 높은 지능 - 뛰어난 전략적 판단
      spirit: 90, // 매우 높은 정신력 - 빠른 회복력
    }),
    new Horse(3, "민첩이", {
      strength: 70, // 평균 이상 힘
      endurance: 75, // 평균 이상 지구력
      agility: 95, // 매우 높은 민첩성 - 뛰어난 가속력
      intelligence: 80, // 높은 지능
      spirit: 70, // 평균 정신력
    }),
    new Horse(4, "균형잡힌", {
      strength: 80, // 균형잡힌 힘
      endurance: 80, // 균형잡힌 지구력
      agility: 80, // 균형잡힌 민첩성
      intelligence: 80, // 균형잡힌 지능
      spirit: 80, // 균형잡힌 정신력
    }),
    new Horse(5, "천재마", {
      strength: 65, // 낮은 힘
      endurance: 70, // 평균 지구력
      agility: 75, // 평균 이상 민첩성
      intelligence: 95, // 매우 높은 지능 - 최고의 판단력
      spirit: 85, // 높은 정신력
    }),
    new Horse(6, "파워하우스", {
      strength: 98, // 최고 힘 - 최대 속도
      endurance: 50, // 낮은 지구력 - 스태미나 부족
      agility: 60, // 낮은 민첩성 - 느린 가속
      intelligence: 70, // 평균 지능
      spirit: 65, // 평균 이하 정신력
    }),
  ];
}

export function createRandomHorse(id: number, name: string): Horse {
  return new Horse(id, name, {
    strength: Math.floor(Math.random() * 60) + 40, // 40-100
    endurance: Math.floor(Math.random() * 60) + 40, // 40-100
    agility: Math.floor(Math.random() * 60) + 40, // 40-100
    intelligence: Math.floor(Math.random() * 60) + 40, // 40-100
    spirit: Math.floor(Math.random() * 60) + 40, // 40-100
  });
}

export function convertHorsesForRace(
  horses: {
    horseId: number;
    name: string;
    strength: number;
    endurance: number;
    agility: number;
    intelligence: number;
    spirit: number;
  }[]
): Horse[] {
  const convertedHorses: Horse[] = new Array<Horse>(horses.length);
  for (let index = 0; index < horses.length; index++) {
    const horse = horses[index];
    convertedHorses[index] = new Horse(horse.horseId, horse.name, {
      strength: horse.strength,
      endurance: horse.endurance,
      agility: horse.agility,
      intelligence: horse.intelligence,
      spirit: horse.spirit,
    });
  }
  return convertedHorses;
}
