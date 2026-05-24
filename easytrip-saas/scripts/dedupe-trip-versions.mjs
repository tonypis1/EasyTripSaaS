#!/usr/bin/env node
/**
 * EasyTrip — bonifica duplicati TripVersion.
 *
 * Lo schema TripVersion non aveva, fino alla migrazione "unique_trip_version",
 * un vincolo @@unique([tripId, versionNum]). In presenza di retry Inngest o
 * race condition era quindi possibile finire con due righe TripVersion con lo
 * stesso (tripId, versionNum). Questo script identifica e rimuove i duplicati,
 * preparando il DB ad accettare la migrazione che introduce il vincolo.
 *
 * Strategia di scelta:
 *   1. Se almeno una riga del gruppo ha isActive=true → tieni quella.
 *   2. Altrimenti tieni la più recente per generatedAt.
 *   3. Tiebreak finale: id alfabetico (deterministico).
 * Le righe scartate vengono cancellate; i Day collegati spariscono per cascade
 * (vedi prisma/schema.prisma: Day.tripVersion onDelete: Cascade).
 *
 * Uso (da easytrip-saas/):
 *   node scripts/dedupe-trip-versions.mjs              # dry-run, NON cancella
 *   node scripts/dedupe-trip-versions.mjs --apply      # esegue le cancellazioni
 *   node scripts/dedupe-trip-versions.mjs --json       # output strutturato
 *
 * Sicurezza: dry-run di default. Niente azioni distruttive senza --apply.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const asJson = args.includes("--json");

const prisma = new PrismaClient();

/**
 * Risultato di groupBy: per ogni (tripId, versionNum) restituisce il numero
 * di occorrenze. Filtro a livello DB con `having` per scaricare solo i gruppi
 * problematici (count >= 2).
 */
async function findDuplicateGroups() {
  return prisma.tripVersion.groupBy({
    by: ["tripId", "versionNum"],
    _count: { _all: true },
    having: { tripId: { _count: { gt: 1 } } },
    orderBy: [{ tripId: "asc" }, { versionNum: "asc" }],
  });
}

async function main() {
  const groups = await findDuplicateGroups();

  if (groups.length === 0) {
    if (asJson) {
      console.log(
        JSON.stringify({ duplicateGroups: 0, rowsToDelete: 0, applied: false }),
      );
    } else {
      console.log("✓ Nessun duplicato (tripId, versionNum) trovato.");
    }
    return;
  }

  // Per ogni gruppo, decido cosa tenere e cosa cancellare.
  const decisions = []; // { tripId, versionNum, keepId, deleteIds: [...] }
  for (const g of groups) {
    const rows = await prisma.tripVersion.findMany({
      where: { tripId: g.tripId, versionNum: g.versionNum },
      orderBy: [
        { isActive: "desc" }, // true prima di false
        { generatedAt: "desc" }, // più recente prima
        { id: "asc" }, // tiebreak deterministico
      ],
      select: {
        id: true,
        isActive: true,
        generatedAt: true,
      },
    });
    const [keep, ...rest] = rows;
    decisions.push({
      tripId: g.tripId,
      versionNum: g.versionNum,
      keepId: keep.id,
      keepIsActive: keep.isActive,
      keepGeneratedAt: keep.generatedAt.toISOString(),
      deleteIds: rest.map((r) => r.id),
    });
  }

  const idsToDelete = decisions.flatMap((d) => d.deleteIds);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          duplicateGroups: decisions.length,
          rowsToDelete: idsToDelete.length,
          decisions,
          applied: false,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Trovati ${decisions.length} gruppi (tripId, versionNum) con duplicati.`,
    );
    console.log(
      `Righe TripVersion totali da cancellare: ${idsToDelete.length}\n`,
    );
    for (const d of decisions) {
      console.log(
        `  trip=${d.tripId}  v${d.versionNum}: tengo id=${d.keepId} ` +
          `(active=${d.keepIsActive}, generatedAt=${d.keepGeneratedAt}), ` +
          `cancello ${d.deleteIds.length}`,
      );
    }
  }

  if (!apply) {
    if (!asJson) {
      console.log(
        "\nDry-run: nessuna modifica al DB. Per applicare, rilancia con --apply.",
      );
    }
    return;
  }

  // Cancellazione in batch (chunked per evitare query troppo grandi).
  const CHUNK = 500;
  let deletedTotal = 0;
  for (let i = 0; i < idsToDelete.length; i += CHUNK) {
    const slice = idsToDelete.slice(i, i + CHUNK);
    const res = await prisma.tripVersion.deleteMany({
      where: { id: { in: slice } },
    });
    deletedTotal += res.count;
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          duplicateGroups: decisions.length,
          rowsToDelete: idsToDelete.length,
          rowsDeleted: deletedTotal,
          applied: true,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `\n✓ Cancellate ${deletedTotal} righe TripVersion. ` +
        `I Day collegati sono stati rimossi per cascade.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("✗ Errore durante la bonifica:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
