import { readFile } from "node:fs/promises";
import path from "node:path";

type ShareCardFont = {
  name: string;
  data: ArrayBuffer;
  weight: 700 | 800;
  style: "normal";
};

let fontsCache: Promise<ShareCardFont[]> | null = null;

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function loadShareCardFonts(): Promise<ShareCardFont[]> {
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const [boldBuffer, extraBoldBuffer] = await Promise.all([
    readFile(path.join(fontsDir, "manrope-700.ttf")),
    readFile(path.join(fontsDir, "manrope-800.ttf")),
  ]);

  return [
    {
      name: "Manrope",
      data: bufferToArrayBuffer(boldBuffer),
      weight: 700,
      style: "normal",
    },
    {
      name: "Manrope",
      data: bufferToArrayBuffer(extraBoldBuffer),
      weight: 800,
      style: "normal",
    },
  ];
}

export function getShareCardFonts() {
  if (!fontsCache) {
    fontsCache = loadShareCardFonts();
  }
  return fontsCache;
}
