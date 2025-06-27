import { createCornerFromSegment } from "./raceCorner";
import { createHorizontalLine, createLineFromSegment } from "./raceLine";
import { Point, RaceSegment } from "./raceSegment";
import { SegmentLengthBuilder } from "./raceSegmentLength";

export class NextSegmentBuilder {
  private segmentType: "line" | "corner" = "line";
  private trackStartPoint: Point = { x: 0, y: 0 };
  private remainingSegmentPattern: ("line" | "corner")[] = [];
  private remainingSegments: number = 0;
  private remainingTrackLength: number = 0;
  private remainingAngle: number = 0;
  private previousSegment: RaceSegment | null = null;
  private segmentLengthBuilder: SegmentLengthBuilder;

  constructor() {
    this.segmentLengthBuilder = new SegmentLengthBuilder();
  }

  setSegmentType(type: "line" | "corner"): NextSegmentBuilder {
    this.segmentType = type;
    this.segmentLengthBuilder.setSegmentType(type);
    return this;
  }

  setTrackStartPoint(point: Point): NextSegmentBuilder {
    this.trackStartPoint = point;
    this.segmentLengthBuilder.setTrackStartPoint(point);
    return this;
  }

  setRemainingSegmentPattern(
    pattern: ("line" | "corner")[]
  ): NextSegmentBuilder {
    this.remainingSegmentPattern = pattern;
    this.segmentLengthBuilder.setRemainingSegmentPattern(pattern);
    return this;
  }

  setRemainingSegments(count: number): NextSegmentBuilder {
    this.remainingSegments = count;
    this.segmentLengthBuilder.setRemainingSegments(count);
    return this;
  }

  setRemainingTrackLength(length: number): NextSegmentBuilder {
    this.remainingTrackLength = length;
    this.segmentLengthBuilder.setRemainingTrackLength(length);
    return this;
  }

  setRemainingAngle(angle: number): NextSegmentBuilder {
    this.remainingAngle = angle;
    this.segmentLengthBuilder.setRemainingAngle(angle);
    return this;
  }

  setPreviousSegment(segment: RaceSegment | null): NextSegmentBuilder {
    this.previousSegment = segment;
    this.segmentLengthBuilder.setPreviousSegment(segment);
    return this;
  }

  private calculateCornerAngle(): number {
    const isLastSegment = this.remainingSegments === 1;
    if (isLastSegment) {
      return this.remainingAngle;
    }
    const remainingCorners =
      Math.floor(this.remainingSegments / 2) + (this.remainingSegments % 2);
    const cornerAngle =
      remainingCorners > 0
        ? this.remainingAngle / remainingCorners
        : this.remainingAngle;
    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cornerAngle));
  }

  build(): RaceSegment {
    if (!this.previousSegment) {
      const segmentLength = this.segmentLengthBuilder
        .setCornerAngle(null)
        .build();
      return createHorizontalLine(segmentLength);
    }
    if (this.segmentType === "corner") {
      const cornerAngle = this.calculateCornerAngle();
      const segmentLength = this.segmentLengthBuilder
        .setCornerAngle(cornerAngle)
        .build();
      return createCornerFromSegment(
        this.previousSegment,
        segmentLength,
        cornerAngle
      );
    } else {
      const segmentLength = this.segmentLengthBuilder
        .setCornerAngle(null)
        .build();
      return createLineFromSegment(this.previousSegment, segmentLength);
    }
  }
}

export function createNextSegment(
  segmentType: "line" | "corner",
  trackStartPoint: Point,
  remainingSegments: number,
  remainingTrackLength: number,
  remainingAngle: number,
  previousSegment: RaceSegment | null
): RaceSegment {
  return new NextSegmentBuilder()
    .setSegmentType(segmentType)
    .setTrackStartPoint(trackStartPoint)
    .setRemainingSegments(remainingSegments)
    .setRemainingTrackLength(remainingTrackLength)
    .setRemainingAngle(remainingAngle)
    .setPreviousSegment(previousSegment)
    .build();
}
