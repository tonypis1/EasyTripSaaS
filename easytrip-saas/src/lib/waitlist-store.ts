import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/config/unifiedConfig";

type WaitlistStats = {
  count: number;
  capacity: number;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), ".waitlist.json");

async function ensureStoreFile() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: WaitlistStats = {
      count: config.waitlist.initialCount,
      capacity: config.waitlist.capacity,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

export async function getWaitlistStats(): Promise<WaitlistStats> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<WaitlistStats>;

  return {
    count:
      parsed?.count != null && Number.isFinite(Number(parsed.count))
        ? Number(parsed.count)
        : config.waitlist.initialCount,
    capacity:
      parsed?.capacity != null && Number.isFinite(Number(parsed.capacity))
        ? Number(parsed.capacity)
        : config.waitlist.capacity,
    updatedAt:
      typeof parsed?.updatedAt === "string" && parsed.updatedAt.length > 0
        ? parsed.updatedAt
        : new Date().toISOString(),
  };
}

export async function incrementWaitlistCount() {
  const stats = await getWaitlistStats();
  const next: WaitlistStats = {
    ...stats,
    count: stats.count + 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

