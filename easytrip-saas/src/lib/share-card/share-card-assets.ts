import { readFile } from "node:fs/promises";
import path from "node:path";

let logoDataUrlCache: Promise<string> | null = null;

async function loadLogoDataUrl(): Promise<string> {
  const logoPath = path.join(process.cwd(), "public", "brand", "easytrip-badge.png");
  const logoBuffer = await readFile(logoPath);
  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

export function getShareCardLogoDataUrl() {
  if (!logoDataUrlCache) {
    logoDataUrlCache = loadLogoDataUrl();
  }
  return logoDataUrlCache;
}
