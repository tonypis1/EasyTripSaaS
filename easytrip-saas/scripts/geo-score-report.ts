/**
 * EasyTrip — confronto GeoScore dichiarato vs calcolato sulle versioni esistenti.
 *
 * Prima del calcolo indipendente, `TripVersion.geoScore` era l'`optimizationScore`
 * auto-dichiarato dal modello. Questo script ricalcola il punteggio dalle
 * coordinate degli slot salvati (stessa logica dell'app: src/lib/geo-optimization.ts),
 * riporta quanto i due valori divergono e, con --apply, allinea il salvato
 * al calcolato (dashboard e versioni non attive lo leggono dal DB).
 *
 * Non serve per il dettaglio viaggio né per la card di condivisione: lì il
 * punteggio della versione attiva è già calcolato al momento della lettura.
 *
 * Uso (da easytrip-saas/, richiede DATABASE_URL):
 *   npx tsx scripts/geo-score-report.ts                  # dry-run: solo report
 *   npx tsx scripts/geo-score-report.ts --active-only    # solo versioni attive
 *   npx tsx scripts/geo-score-report.ts --json           # output strutturato
 *   npx tsx scripts/geo-score-report.ts --apply          # aggiorna geoScore
 *
 * Sicurezza: dry-run di default; --apply tocca solo `geoScore` e solo dove il
 * punteggio è calcolabile e differisce di almeno 0.1.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  analyzeItineraryGeo,
  geoInputFromStoredDay,
} from "@/lib/geo-optimization";
import {
  compareGeoScores,
  type GeoScoreComparisonRow,
} from "@/lib/geo-score-report";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const asJson = args.includes("--json");
const activeOnly = args.includes("--active-only");

const BATCH_SIZE = 200;
const MIN_UPDATE_DELTA = 0.1;

const prisma = new PrismaClient();

async function main() {
  const rows: GeoScoreComparisonRow[] = [];
  const updates: { versionId: string; computed: number }[] = [];
  let cursor: string | undefined;

  for (;;) {
    const versions = await prisma.tripVersion.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        geoScore: true,
        days: {
          orderBy: { dayNumber: "asc" },
          select: {
            dayNumber: true,
            morning: true,
            afternoon: true,
            evening: true,
          },
        },
      },
    });
    if (versions.length === 0) break;
    cursor = versions[versions.length - 1].id;

    for (const v of versions) {
      const stored = v.geoScore != null ? Number(v.geoScore) : null;
      const { score: computed } = analyzeItineraryGeo(
        v.days.map(geoInputFromStoredDay),
      );
      rows.push({ versionId: v.id, stored, computed });

      if (
        computed != null &&
        (stored == null || Math.abs(computed - stored) >= MIN_UPDATE_DELTA)
      ) {
        updates.push({ versionId: v.id, computed });
      }
    }
  }

  const summary = compareGeoScores(rows);

  let applied = 0;
  if (apply) {
    for (const u of updates) {
      await prisma.tripVersion.update({
        where: { id: u.versionId },
        data: { geoScore: u.computed },
      });
      applied++;
    }
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          summary,
          toUpdate: updates.length,
          applied,
        },
        null,
        2,
      ),
    );
    return;
  }

  const pct = (n: number) =>
    summary.comparable === 0
      ? "—"
      : `${Math.round((n / summary.comparable) * 100)}%`;
  console.log(
    `\nGeoScore dichiarato vs calcolato (${apply ? "APPLY" : "dry-run"})`,
  );
  console.log("─".repeat(56));
  console.log(`Versioni analizzate:        ${summary.versions}`);
  console.log(`Confrontabili:              ${summary.comparable}`);
  console.log(`Coordinate insufficienti:   ${summary.unscorable}`);
  console.log(`Media dichiarato:           ${summary.meanStored ?? "—"}`);
  console.log(`Media calcolato:            ${summary.meanComputed ?? "—"}`);
  console.log(`Scarto medio (calc − dich): ${summary.meanDelta ?? "—"}`);
  console.log(`Scarto assoluto medio:      ${summary.meanAbsDelta ?? "—"}`);
  console.log(
    `Dichiarato troppo alto (≥1): ${summary.declaredTooHigh} (${pct(summary.declaredTooHigh)})`,
  );
  console.log(
    `Dichiarato troppo basso (≥1): ${summary.declaredTooLow} (${pct(summary.declaredTooLow)})`,
  );
  console.log(
    `Entro ±1 punto:             ${summary.withinOne} (${pct(summary.withinOne)})`,
  );
  if (summary.largest.length > 0) {
    console.log("\nDivergenze maggiori:");
    for (const l of summary.largest) {
      console.log(
        `  ${l.versionId}  dichiarato ${l.stored.toFixed(1)}  calcolato ${l.computed.toFixed(1)}  (${l.delta > 0 ? "+" : ""}${l.delta.toFixed(1)})`,
      );
    }
  }
  console.log(
    apply
      ? `\nAggiornate ${applied} versioni.`
      : `\nDa aggiornare con --apply: ${updates.length} versioni.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
