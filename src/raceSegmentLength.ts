import { Point, RaceSegment } from "./raceSegment";

export class SegmentLengthBuilder {
  private currentSegmentType: "line" | "corner" = "line";
  private cornerAngle: number | null = null;
  private trackStartPoint: Point = { x: 0, y: 0 };
  private remainingSegmentPattern: ("line" | "corner")[] = [];
  private remainingSegments: number = 0;
  private remainingTrackLength: number = 0;
  private previousSegment: RaceSegment | null = null;
  private remainingAngle: number = 0;

  setSegmentType(type: "line" | "corner"): SegmentLengthBuilder {
    this.currentSegmentType = type;
    return this;
  }

  setCornerAngle(angle: number | null): SegmentLengthBuilder {
    this.cornerAngle = angle;
    return this;
  }

  setTrackStartPoint(point: Point): SegmentLengthBuilder {
    this.trackStartPoint = point;
    return this;
  }

  setRemainingSegmentPattern(
    pattern: ("line" | "corner")[]
  ): SegmentLengthBuilder {
    this.remainingSegmentPattern = pattern;
    return this;
  }

  setRemainingSegments(count: number): SegmentLengthBuilder {
    this.remainingSegments = count;
    return this;
  }

  setRemainingTrackLength(length: number): SegmentLengthBuilder {
    this.remainingTrackLength = length;
    return this;
  }

  setRemainingAngle(angle: number): SegmentLengthBuilder {
    this.remainingAngle = angle;
    return this;
  }

  setPreviousSegment(segment: RaceSegment | null): SegmentLengthBuilder {
    this.previousSegment = segment;
    return this;
  }

  private quantizeSegmentLength(length: number): number {
    return Math.max(50, Math.round(length / 50) * 50);
  }

  private calculateGeometricConstraints(): {
    minLength: number;
    maxLength: number;
  } {
    const previousSegmentEndPoint =
      this.previousSegment?.end ?? this.trackStartPoint;

    const distanceToStart = Math.sqrt(
      Math.pow(previousSegmentEndPoint.x - this.trackStartPoint.x, 2) +
        Math.pow(previousSegmentEndPoint.y - this.trackStartPoint.y, 2)
    );

    let geometricMinLength = 50;
    let geometricMaxLength = this.remainingTrackLength;

    if (this.currentSegmentType === "corner") {
      if (this.cornerAngle === null) {
        throw new Error("코너 세그먼트의 경우 cornerAngle이 필요합니다.");
      }

      // 코너의 물리적 제약
      const maxRadius = Math.min(500, this.remainingTrackLength / 4);
      const minRadius = 50;
      const radiusBasedMaxLength = Math.abs(maxRadius * this.cornerAngle);
      const radiusBasedMinLength = Math.abs(minRadius * this.cornerAngle);

      // 클로저 가능성 계산
      const closureConstraints = this.calculateClosureConstraints(
        previousSegmentEndPoint,
        this.cornerAngle,
        true
      );

      geometricMinLength = Math.max(
        radiusBasedMinLength,
        closureConstraints.minLength
      );
      geometricMaxLength = Math.min(
        radiusBasedMaxLength,
        closureConstraints.maxLength
      );
    } else {
      // 직선의 클로저 가능성 계산
      const closureConstraints = this.calculateClosureConstraints(
        previousSegmentEndPoint,
        0,
        false
      );

      geometricMinLength = Math.max(50, closureConstraints.minLength);
      geometricMaxLength = Math.min(
        this.remainingTrackLength,
        closureConstraints.maxLength
      );
    }

    return { minLength: geometricMinLength, maxLength: geometricMaxLength };
  }

  private calculateClosureConstraints(
    currentPosition: Point,
    segmentAngle: number,
    isCorner: boolean
  ): { minLength: number; maxLength: number } {
    const dx = this.trackStartPoint.x - currentPosition.x;
    const dy = this.trackStartPoint.y - currentPosition.y;
    const directDistance = Math.sqrt(dx * dx + dy * dy);

    const remainingSegmentsAfterThis = this.remainingSegments - 1;
    const remainingPattern = this.remainingSegmentPattern.slice(1); // 현재 세그먼트 이후의 패턴

    if (remainingSegmentsAfterThis === 0) {
      // 마지막 세그먼트: 정확한 클로저 계산
      if (isCorner) {
        const radius =
          directDistance / (2 * Math.sin(Math.abs(segmentAngle) / 2));
        if (radius < 50 || radius > 500 || Math.abs(segmentAngle) < 0.01) {
          return {
            minLength: this.remainingTrackLength,
            maxLength: this.remainingTrackLength,
          };
        }
        const exactLength = Math.abs(radius * segmentAngle);
        return { minLength: exactLength, maxLength: exactLength };
      } else {
        return { minLength: directDistance, maxLength: directDistance };
      }
    }

    // 남은 세그먼트 패턴 분석
    const remainingCorners = remainingPattern.filter(
      (type) => type === "corner"
    ).length;
    const remainingLines = remainingPattern.filter(
      (type) => type === "line"
    ).length;

    // 남은 코너들의 각도 분배 계산
    const remainingAngleAfterThis =
      this.remainingAngle - (isCorner ? segmentAngle : 0);
    const avgAnglePerCorner =
      remainingCorners > 0 ? remainingAngleAfterThis / remainingCorners : 0;

    // 남은 세그먼트들의 길이 제약 계산
    const minRemainingLength = remainingSegmentsAfterThis * 50;
    const maxRemainingLength = this.remainingTrackLength - 50;

    // 남은 패턴으로 실제 도달 가능한 범위 계산
    const reachabilityConstraints = this.calculateReachabilityWithPattern(
      currentPosition,
      remainingPattern,
      remainingAngleAfterThis,
      minRemainingLength,
      maxRemainingLength
    );

    const minLength = Math.max(50, reachabilityConstraints.minThisSegment);
    const maxLength = Math.min(
      this.remainingTrackLength - minRemainingLength,
      reachabilityConstraints.maxThisSegment
    );

    return {
      minLength: Math.max(minLength, 0),
      maxLength: Math.max(maxLength, minLength),
    };
  }

  private calculateReachabilityWithPattern(
    currentPosition: Point,
    remainingPattern: ("line" | "corner")[],
    remainingAngle: number,
    minRemainingLength: number,
    maxRemainingLength: number
  ): { minThisSegment: number; maxThisSegment: number } {
    const dx = this.trackStartPoint.x - currentPosition.x;
    const dy = this.trackStartPoint.y - currentPosition.y;
    const directDistance = Math.sqrt(dx * dx + dy * dy);

    if (remainingPattern.length === 0) {
      return { minThisSegment: 50, maxThisSegment: this.remainingTrackLength };
    }

    // 현재 세그먼트의 시작 방향 계산
    const currentDirection = this.getCurrentDirection();

    // 여러 길이 후보를 테스트해서 클로저 가능성 확인
    const testLengths = this.generateTestLengths();
    let validMinLength = this.remainingTrackLength;
    let validMaxLength = 50;

    for (const testLength of testLengths) {
      if (testLength > this.remainingTrackLength - minRemainingLength) continue;
      if (testLength < 50) continue;

      // 이 길이로 현재 세그먼트를 만들었을 때의 최종 위치와 방향 계산
      const { position: nextPosition, direction: nextDirection } =
        this.simulateThisSegment(currentPosition, currentDirection, testLength);

      // 남은 패턴으로 시작점에 도달 가능한지 확인
      const remainingLengthAfterThis = this.remainingTrackLength - testLength;
      const canReachStart = this.canReachStartWithPattern(
        nextPosition,
        nextDirection,
        remainingPattern,
        remainingAngle,
        remainingLengthAfterThis
      );

      if (canReachStart) {
        validMinLength = Math.min(validMinLength, testLength);
        validMaxLength = Math.max(validMaxLength, testLength);
      }
    }

    // 유효한 범위가 없으면 기본값 사용
    if (validMinLength > validMaxLength) {
      return {
        minThisSegment: 50,
        maxThisSegment: Math.max(
          50,
          this.remainingTrackLength - minRemainingLength
        ),
      };
    }

    return {
      minThisSegment: validMinLength,
      maxThisSegment: validMaxLength,
    };
  }

  private getCurrentDirection(): number {
    if (!this.previousSegment) {
      return 0; // 첫 번째 세그먼트는 수평 방향
    }

    // 이전 세그먼트의 끝 방향 계산
    if (this.previousSegment.type === "corner") {
      const corner = this.previousSegment as any; // RaceCorner 타입
      return corner.endAngle + Math.PI / 2; // 접선 방향
    } else {
      // 직선의 방향
      const dx = this.previousSegment.end.x - this.previousSegment.start.x;
      const dy = this.previousSegment.end.y - this.previousSegment.start.y;
      return Math.atan2(dy, dx);
    }
  }

  private generateTestLengths(): number[] {
    const minLength = 50;
    const maxLength =
      this.remainingTrackLength - (this.remainingSegments - 1) * 50;
    const step = 50; // 50m 단위로 테스트

    const lengths: number[] = [];
    for (let length = minLength; length <= maxLength; length += step) {
      lengths.push(length);
    }
    return lengths;
  }

  private simulateThisSegment(
    currentPosition: Point,
    currentDirection: number,
    segmentLength: number
  ): { position: Point; direction: number } {
    if (this.currentSegmentType === "line") {
      // 직선: 현재 방향으로 직진
      return {
        position: {
          x: currentPosition.x + segmentLength * Math.cos(currentDirection),
          y: currentPosition.y + segmentLength * Math.sin(currentDirection),
        },
        direction: currentDirection, // 방향 변화 없음
      };
    } else {
      // 코너: 호를 그리며 회전
      const angle = this.cornerAngle!;
      const radius = segmentLength / Math.abs(angle);

      // 코너 중심 계산
      const centerDirection =
        currentDirection + (angle > 0 ? Math.PI / 2 : -Math.PI / 2);
      const centerX = currentPosition.x + radius * Math.cos(centerDirection);
      const centerY = currentPosition.y + radius * Math.sin(centerDirection);

      // 코너 끝 위치 계산
      const startAngle = Math.atan2(
        currentPosition.y - centerY,
        currentPosition.x - centerX
      );
      const endAngle = startAngle + angle;

      return {
        position: {
          x: centerX + radius * Math.cos(endAngle),
          y: centerY + radius * Math.sin(endAngle),
        },
        direction: currentDirection + angle, // 방향 변화
      };
    }
  }

  private canReachStartWithPattern(
    position: Point,
    direction: number,
    pattern: ("line" | "corner")[],
    remainingAngle: number,
    remainingLength: number
  ): boolean {
    if (pattern.length === 0) {
      // 더 이상 세그먼트가 없으면 현재 위치가 시작점이어야 함
      const distance = Math.sqrt(
        Math.pow(position.x - this.trackStartPoint.x, 2) +
          Math.pow(position.y - this.trackStartPoint.y, 2)
      );
      return distance < 10; // 10m 이내면 성공
    }

    if (pattern.length === 1) {
      // 마지막 세그먼트로 시작점에 정확히 도달해야 함
      const lastSegmentType = pattern[0];

      if (lastSegmentType === "line") {
        // 직선으로 시작점까지의 거리
        const dx = this.trackStartPoint.x - position.x;
        const dy = this.trackStartPoint.y - position.y;
        const requiredDistance = Math.sqrt(dx * dx + dy * dy);
        const requiredDirection = Math.atan2(dy, dx);

        // 현재 방향과 필요한 방향이 일치하는지 확인
        let angleDiff = Math.abs(requiredDirection - direction);
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        angleDiff = Math.abs(angleDiff);

        return (
          angleDiff < 0.1 && // 방향 오차 허용
          requiredDistance >= 50 &&
          requiredDistance <= remainingLength
        );
      } else {
        // 코너로 시작점까지 도달
        const dx = this.trackStartPoint.x - position.x;
        const dy = this.trackStartPoint.y - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 코너의 가능한 반지름 범위
        const minRadius = 50;
        const maxRadius = 500;
        const minLength = Math.abs(minRadius * remainingAngle);
        const maxLength = Math.abs(maxRadius * remainingAngle);

        // 거리가 코너로 도달 가능한 범위 내인지 확인
        return (
          distance <= distance * 1.5 && // 코너는 더 유연함
          remainingLength >= minLength &&
          remainingLength <= maxLength
        );
      }
    }

    // 중간 세그먼트가 여러 개 있는 경우: 간소화된 체크
    // 남은 세그먼트들의 최대 도달 거리와 현재 거리 비교
    const dx = this.trackStartPoint.x - position.x;
    const dy = this.trackStartPoint.y - position.y;
    const distanceToStart = Math.sqrt(dx * dx + dy * dy);

    // 남은 세그먼트들로 최대한 갈 수 있는 거리
    const maxReachableDistance = remainingLength * 1.2; // 코너를 고려한 여유

    return distanceToStart <= maxReachableDistance;
  }

  build(): number {
    const averageLength = this.remainingTrackLength / this.remainingSegments;
    const { minLength: geometricMinLength, maxLength: geometricMaxLength } =
      this.calculateGeometricConstraints();

    const isLastSegment = this.remainingSegments === 1;
    if (isLastSegment) {
      // 마지막 세그먼트: 남은 트랙 길이를 모두 사용 (최소 50m 제약만 적용)
      const finalLength = Math.max(50, this.remainingTrackLength);
      return this.quantizeSegmentLength(finalLength);
    }

    // 초기 세그먼트들: 기하학적 제약과 남은 길이 분배를 고려한 랜덤 선택
    const minLength = Math.max(50, geometricMinLength);
    // 남은 세그먼트들이 최소 50m씩 가져갈 수 있도록 여유 공간 계산
    const reserveForRemaining = (this.remainingSegments - 1) * 50;
    const maxLength = Math.min(
      geometricMaxLength,
      this.remainingTrackLength - reserveForRemaining
    );

    if (maxLength <= minLength) {
      return this.quantizeSegmentLength(minLength);
    }

    const randomLength = minLength + Math.random() * (maxLength - minLength);
    return this.quantizeSegmentLength(randomLength);
  }
}

export function createSegmentLength(
  currentSegmentType: "line" | "corner",
  cornerAngle: number | null,
  trackStartPoint: Point,
  remainingSegments: number,
  remainingTrackLength: number,
  previousSegment: RaceSegment | null,
  remainingSegmentPattern: ("line" | "corner")[],
  remainingAngle: number
): number {
  return new SegmentLengthBuilder()
    .setSegmentType(currentSegmentType)
    .setCornerAngle(cornerAngle)
    .setTrackStartPoint(trackStartPoint)
    .setRemainingSegments(remainingSegments)
    .setRemainingTrackLength(remainingTrackLength)
    .setPreviousSegment(previousSegment)
    .setRemainingSegmentPattern(remainingSegmentPattern)
    .setRemainingAngle(remainingAngle)
    .build();
}
