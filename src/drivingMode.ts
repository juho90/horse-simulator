export enum DrivingMode {
  MaintainingPace = "maintainingPace",
  Overtaking = "overtaking",
  Blocked = "blocked",
  Positioning = "positioning",
  Conserving = "conserving",
  LastSpurt = "lastSpurt",
}

export class DrivingModeUtils {
  static getModeDisplayName(mode: DrivingMode): string {
    switch (mode) {
      case DrivingMode.MaintainingPace:
        return "페이스 유지";
      case DrivingMode.Overtaking:
        return "추월 시도";
      case DrivingMode.Blocked:
        return "차단 회피";
      case DrivingMode.Positioning:
        return "위치 선점";
      case DrivingMode.Conserving:
        return "체력 보존";
      case DrivingMode.LastSpurt:
        return "막판 스퍼트";
    }
  }

  static getModeColor(mode: DrivingMode): string {
    switch (mode) {
      case DrivingMode.MaintainingPace:
        return "#4CAF50";
      case DrivingMode.Overtaking:
        return "#FF9800";
      case DrivingMode.Blocked:
        return "#F44336";
      case DrivingMode.Positioning:
        return "#2196F3";
      case DrivingMode.Conserving:
        return "#9C27B0";
      case DrivingMode.LastSpurt:
        return "#FF5722";
    }
  }

  static getModeDescription(mode: DrivingMode): string {
    switch (mode) {
      case DrivingMode.MaintainingPace:
        return "안정적인 속도로 주행하며 체력을 관리합니다";
      case DrivingMode.Overtaking:
        return "적극적으로 앞선 말을 추월하려 시도합니다";
      case DrivingMode.Blocked:
        return "충돌 위험을 감지하여 회피 기동을 수행합니다";
      case DrivingMode.Positioning:
        return "최적의 레이스 라인으로 이동하려 합니다";
      case DrivingMode.Conserving:
        return "체력을 보존하며 속도를 조절합니다";
      case DrivingMode.LastSpurt:
        return "남은 체력을 모두 사용하여 전력 질주합니다";
    }
  }

  static getModeSpeedMultiplier(mode: DrivingMode): number {
    switch (mode) {
      case DrivingMode.MaintainingPace:
        return 0.8;
      case DrivingMode.Overtaking:
        return 0.95;
      case DrivingMode.Blocked:
        return 0.6;
      case DrivingMode.Positioning:
        return 0.75;
      case DrivingMode.Conserving:
        return 0.65;
      case DrivingMode.LastSpurt:
        return 1.0;
    }
  }

  static getModeStaminaMultiplier(mode: DrivingMode): number {
    switch (mode) {
      case DrivingMode.MaintainingPace:
        return 1.0;
      case DrivingMode.Overtaking:
        return 1.3;
      case DrivingMode.Blocked:
        return 0.8;
      case DrivingMode.Positioning:
        return 1.1;
      case DrivingMode.Conserving:
        return 0.7;
      case DrivingMode.LastSpurt:
        return 2.0;
    }
  }

  static isAggressiveMode(mode: DrivingMode): boolean {
    return mode === DrivingMode.Overtaking || mode === DrivingMode.LastSpurt;
  }

  static isSafeMode(mode: DrivingMode): boolean {
    return mode === DrivingMode.Blocked || mode === DrivingMode.Conserving;
  }

  static isTransitionAllowed(from: DrivingMode, to: DrivingMode): boolean {
    if (from === to) {
      return true;
    }
    if (to === DrivingMode.Blocked) {
      return true;
    }
    if (from === DrivingMode.LastSpurt) {
      return to === DrivingMode.Conserving;
    }
    if (from === DrivingMode.Blocked) {
      return true;
    }
    return true;
  }
}
