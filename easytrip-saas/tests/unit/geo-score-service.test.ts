import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeoScoreService } from "@/server/services/trip/geoScoreService";
import type { TripRepository } from "@/server/repositories/TripRepository";

const slot = (lat: number, lng: number) => ({ title: "x", lat, lng });

// Colosseo → Foro → Pantheon (lineare) e Colosseo → Vaticano → Foro (zig-zag).
const linear = {
  dayNumber: 1,
  morning: slot(41.8902, 12.4922),
  afternoon: slot(41.8925, 12.4853),
  evening: slot(41.8986, 12.4769),
};
const zigzag = {
  dayNumber: 2,
  morning: slot(41.8902, 12.4922),
  afternoon: slot(41.9065, 12.4536),
  evening: slot(41.8925, 12.4853),
};
const noCoords = {
  dayNumber: 3,
  morning: { title: "Mattina libera", lat: null, lng: null },
  afternoon: null,
  evening: null,
};

function setup(days: unknown[] | Error) {
  const repo = {
    findVersionDaySlots:
      days instanceof Error
        ? vi.fn().mockRejectedValue(days)
        : vi.fn().mockResolvedValue(days),
    updateVersionGeoScore: vi.fn().mockResolvedValue(undefined),
  };
  return {
    repo,
    service: new GeoScoreService(repo as unknown as TripRepository),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GeoScoreService.refreshForVersion", () => {
  it("ricalcola il punteggio dai giorni salvati e lo scrive sulla versione", async () => {
    const { repo, service } = setup([linear, zigzag]);

    const score = await service.refreshForVersion("ver1");

    expect(repo.findVersionDaySlots).toHaveBeenCalledWith("ver1");
    expect(score).not.toBeNull();
    expect(repo.updateVersionGeoScore).toHaveBeenCalledWith("ver1", score);
    // Media di un giorno lineare (10) e di uno a zig-zag (~7.6).
    expect(score).toBeGreaterThan(8);
    expect(score).toBeLessThan(9.5);
  });

  it("un riordino sbagliato abbassa il punteggio rispetto a uno efficiente", async () => {
    const good = await setup([linear]).service.refreshForVersion("v");
    const bad = await setup([zigzag]).service.refreshForVersion("v");

    expect(good).toBeGreaterThan(bad ?? 99);
  });

  it("con coordinate insufficienti non sovrascrive il punteggio esistente", async () => {
    const { repo, service } = setup([linear, noCoords, noCoords]);

    expect(await service.refreshForVersion("ver1")).toBeNull();
    expect(repo.updateVersionGeoScore).not.toHaveBeenCalled();
  });

  it("non lancia mai: un errore del DB viene assorbito (l'operazione chiamante è già andata a buon fine)", async () => {
    const { repo, service } = setup(new Error("db down"));

    await expect(service.refreshForVersion("ver1")).resolves.toBeNull();
    expect(repo.updateVersionGeoScore).not.toHaveBeenCalled();
  });

  it("assorbe anche un errore in scrittura", async () => {
    const { repo, service } = setup([linear]);
    repo.updateVersionGeoScore.mockRejectedValue(new Error("write failed"));

    await expect(service.refreshForVersion("ver1")).resolves.toBeNull();
  });
});
