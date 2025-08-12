import { createCanvas } from "canvas";
import * as fs from "fs";
import { calcTrackBounds } from "./raceTrack";
import { RaceTrackNode } from "./raceTrackNode";

export function saveTrackPNG(
  racePathfinder: RaceTrackNode,
  outPath: string = "race-track.png"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const raceTrack = racePathfinder.track;
    const { width, height, minX, minY } = calcTrackBounds(raceTrack, 160, 60);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ff00aa";
    for (const prNodes of racePathfinder.nodes) {
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
