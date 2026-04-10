#!/usr/bin/env node
/**
 * Genera un abbozzo di Registro dei trattamenti (RoPA) da commenti nel file Prisma.
 * Convenzione nello schema: righe `/// purpose: ...` e `/// retention: ...` sopra ogni `model`.
 *
 * Uso: node scripts/generate-processing-register.mjs
 * Output: stdout (JSON) o reindirizzare su file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

const raw = fs.readFileSync(schemaPath, "utf8");
const lines = raw.split(/\r?\n/);

/** @type {{ model: string; purpose?: string; retention?: string }[]} */
const entries = [];
let currentModel = null;
let pendingPurpose = null;
let pendingRetention = null;

for (const line of lines) {
  const purposeM = line.match(/^\s*\/\/\/\s*purpose:\s*(.+)\s*$/i);
  const retentionM = line.match(/^\s*\/\/\/\s*retention:\s*(.+)\s*$/i);
  const modelM = line.match(/^model\s+(\w+)\s*\{/);

  if (purposeM) pendingPurpose = purposeM[1].trim();
  if (retentionM) pendingRetention = retentionM[1].trim();

  if (modelM) {
    currentModel = modelM[1];
    entries.push({
      model: currentModel,
      purpose: pendingPurpose ?? undefined,
      retention: pendingRetention ?? undefined,
    });
    pendingPurpose = null;
    pendingRetention = null;
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  sourceFile: "prisma/schema.prisma",
  note:
    "Integrare con base giuridica, responsabili del trattamento e trasferimenti extra-UE. Questo file è un supporto tecnico, non sostituisce il registro GDPR aziendale.",
  models: entries,
  subprocessors: [
    { name: "Clerk", role: "Autenticazione e gestione account" },
    { name: "Stripe", role: "Pagamenti" },
    { name: "Inngest", role: "Code e job in background" },
    { name: "Anthropic", role: "Generazione contenuti itinerario (API server-side)" },
    { name: "Resend", role: "Email transazionali (se configurato)" },
    { name: "PostHog", role: "Analytics prodotto (se abilitato)" },
  ],
};

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
