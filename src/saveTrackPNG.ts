import { createCanvas } from "canvas";
import * as fs from "fs";
import { RaceTrack } from "./raceTrack";
import { RaceTracker } from "./raceTracker";

export function saveTrackPNG(
  raceTrack: RaceTrack,
  raceTracker: RaceTracker,
  outPath: string = "race-track.png"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { width, height, minX, minY } = raceTrack.calcTrackBounds(160, 60);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ff00aa";
    for (const prNodes of raceTracker.getNodes()) {
      for (const laNodes of prNodes) {
        for (const node of laNodes) {
          ctx.beginPath();
          ctx.arc(node.x - minX, node.y - minY, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    const out = fs.createWriteStream(outPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on("finish", () => {
      console.log(`PNG 파일 생성 완료: ${outPath}`);
      resolve();
    });
    out.on("error", (err) => {
      console.error(`PNG 파일 생성 실패: ${err.message}`);
      reject(err);
    });
  });
}
