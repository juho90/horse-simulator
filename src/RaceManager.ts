import { RaceHorse } from "./raceHorse";
import { RaceLogAnalyzer } from "./raceLogAnalyzer";
import { RaceRenderer } from "./raceRenderer";
import { RaceSimulator } from "./raceSimulator";
import { RaceTrack } from "./raceTrack";
import { HORSE_VALUES, TRACK_VALUES, randFloat, randInt } from "./raceValues";

function generateRandomRaceTrack(): RaceTrack {
  const {
    LENGTH_MIN,
    LENGTH_MAX,
    CORNER_COUNT_MIN,
    CORNER_COUNT_MAX,
    STAT_WEIGHT_MIN,
    STAT_WEIGHT_MAX,
  } = TRACK_VALUES;
  const finishLine = randInt(LENGTH_MIN, LENGTH_MAX);
  const cornerCount = randInt(CORNER_COUNT_MIN, CORNER_COUNT_MAX);
  const corners = Array.from({ length: cornerCount }, (_, i) => ({
    start: Math.floor(((i + 1) * finishLine) / (cornerCount + 1)) - 50,
    end: Math.floor(((i + 1) * finishLine) / (cornerCount + 1)) + 50,
    difficulty: randFloat(1, 3),
  }));
  const statWeights = {
    speed: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
    stamina: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
    power: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
    paceSense: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
    cornering: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
    positioning: randFloat(STAT_WEIGHT_MIN, STAT_WEIGHT_MAX),
  };
  return new RaceTrack({
    name: `랜덤트랙${randInt(0, 9999)}`,
    finishLine,
    corners,
    statWeights,
  });
}

function generateRaceHorses(names: string[]): RaceHorse[] {
  const {
    WEIGHT_MIN,
    WEIGHT_MAX,
    STAT_MIN,
    STAT_MAX,
    TEMPERAMENT_MIN,
    TEMPERAMENT_MAX,
    RUNNING_STYLES,
  } = HORSE_VALUES;
  const styles = RUNNING_STYLES;
  return names.map(
    (name, idx) =>
      new RaceHorse(
        {
          profile: {
            name,
            weight: randInt(WEIGHT_MIN, WEIGHT_MAX),
            temperament: randFloat(TEMPERAMENT_MIN, TEMPERAMENT_MAX),
            runningStyle: styles[idx % styles.length],
          },
          stats: {
            speed: randInt(STAT_MIN, STAT_MAX),
            stamina: randInt(STAT_MIN, STAT_MAX),
            power: randInt(STAT_MIN, STAT_MAX),
            paceSense: randInt(STAT_MIN, STAT_MAX),
            cornering: randInt(STAT_MIN, STAT_MAX),
            positioning: randInt(STAT_MIN, STAT_MAX),
          },
        },
        idx + 1
      )
  );
}

export class RaceManager {
  run() {
    const raceTrack = generateRandomRaceTrack();
    const horseNames = [
      "썬더",
      "블리츠",
      "윈드",
      "스톰",
      "플래시",
      "스피릿",
      "에이스",
      "로켓",
    ];
    const horses = generateRaceHorses(horseNames);
    const simulator = new RaceSimulator(raceTrack, horses);
    const logs = simulator.run();
    const analyzer = new RaceLogAnalyzer(logs);
    analyzer.saveRaceLogs(logs, "race_log.json");
    analyzer.saveStatsJson("race_stats.json");
    analyzer.printSummaryToConsoleWithProfiles(horses);
    RaceRenderer.renderVisualizerHtml(logs, raceTrack);
  }
}
