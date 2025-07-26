export enum DrivingMode {
  MaintainingPace = "maintainingPace",
  Overtaking = "overtaking",
  Positioning = "positioning",
  Conserving = "conserving",
  LastSpurt = "lastSpurt",
}

export function getModeDisplayName(mode: DrivingMode): string {
  switch (mode) {
    case DrivingMode.MaintainingPace:
      return "페이스 유지";
    case DrivingMode.Overtaking:
      return "추월 시도";
    case DrivingMode.Positioning:
      return "위치 선점";
    case DrivingMode.Conserving:
      return "체력 보존";
    case DrivingMode.LastSpurt:
      return "막판 스퍼트";
  }
}

export function getModeColor(mode: DrivingMode): string {
  switch (mode) {
    case DrivingMode.MaintainingPace:
      return "#4CAF50";
    case DrivingMode.Overtaking:
      return "#F44336";
    case DrivingMode.Positioning:
      return "#2196F3";
    case DrivingMode.Conserving:
      return "#9C27B0";
    case DrivingMode.LastSpurt:
      return "#FF5722";
  }
}

export function getModeSpeedMultiplier(mode: DrivingMode): number {
  switch (mode) {
    case DrivingMode.MaintainingPace:
      return 0.8;
    case DrivingMode.Overtaking:
      return 0.95;
    case DrivingMode.Positioning:
      return 0.75;
    case DrivingMode.Conserving:
      return 0.65;
    case DrivingMode.LastSpurt:
      return 1.0;
  }
}

export function getModeStaminaMultiplier(mode: DrivingMode): number {
  switch (mode) {
    case DrivingMode.MaintainingPace:
      return 1.0;
    case DrivingMode.Overtaking:
      return 1.3;
    case DrivingMode.Positioning:
      return 1.1;
    case DrivingMode.Conserving:
      return 0.7;
    case DrivingMode.LastSpurt:
      return 2.0;
  }
}

export function isAggressiveMode(mode: DrivingMode): boolean {
  return mode === DrivingMode.Overtaking || mode === DrivingMode.LastSpurt;
}

export function isSafeMode(mode: DrivingMode): boolean {
  return mode === DrivingMode.Conserving;
}

export function isTransitionAllowed(
  from: DrivingMode,
  to: DrivingMode
): boolean {
  if (from === to) {
    return true;
  }
  if (from === DrivingMode.LastSpurt) {
    return to === DrivingMode.Conserving;
  }
  return true;
}
