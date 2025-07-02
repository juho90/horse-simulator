import { createCornerFromSegment } from "./raceCorner";
import { createHorizontalLine, createLineFromSegment } from "./raceLine";
import { Point, RaceSegment } from "./raceSegment";
import { SegmentLengthBuilder } from "./raceSegmentLength";

export class NextSegmentBuilder {
  private segmentType: "line" | "corner" = "line";
  private trackStartPoint: Point = { x: 0, y: 0 };
  private segmentPattern: ("line" | "corner")[] = [];
  private segmentIndex: number = 0;
  private remainTrackLength: number = 0;
  private remainAngle: number = 0;
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

  setSegmentPattern(pattern: ("line" | "corner")[]): NextSegmentBuilder {
    this.segmentPattern = pattern;
    this.segmentLengthBuilder.setRemainSegmentPattern(pattern);
    return this;
  }

  setSegmentIndex(index: number): NextSegmentBuilder {
    this.segmentIndex = index;
    this.segmentLengthBuilder.setRemainSegments(this.getRemainSegments());
    return this;
  }

  setRemainTrackLength(length: number): NextSegmentBuilder {
    this.remainTrackLength = length;
    this.segmentLengthBuilder.setRemainTrackLength(length);
    return this;
  }

  setRemainAngle(angle: number): NextSegmentBuilder {
    this.remainAngle = angle;
    this.segmentLengthBuilder.setRemainAngle(angle);
    return this;
  }

  setPreviousSegment(segment: RaceSegment | null): NextSegmentBuilder {
    this.previousSegment = segment;
    this.segmentLengthBuilder.setPreviousSegment(segment);
    return this;
  }

  private getRemainSegments(): number {
    return this.segmentPattern.length - (this.segmentIndex + 1);
  }

  private calculateCornerAngle(): number {
    const remainSegments = this.getRemainSegments();
    const isLastSegment = remainSegments === 1;
    if (isLastSegment) {
      return this.remainAngle;
    }
    const remainCorners = Math.floor(remainSegments / 2) + (remainSegments % 2);
    const cornerAngle =
      remainCorners > 0 ? this.remainAngle / remainCorners : this.remainAngle;
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
