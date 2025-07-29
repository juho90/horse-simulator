import { createCanvas } from "canvas";
import * as fs from "fs";

export function saveSampleNodesImage(
  sampleNodes: { x: number; y: number }[],
  width: number,
  height: number,
  outPath: string = "sampleNodes.png"
) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ff00aa";
  for (const node of sampleNodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }

  const out = fs.createWriteStream(outPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on("finish", () => {
    console.log(`PNG 파일 생성 완료: ${outPath}`);
  });
}
