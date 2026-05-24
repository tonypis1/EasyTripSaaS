#!/usr/bin/env node
/**
 * Verifica post-deploy: GET /api/health e raggiungibilità homepage.
 *
 * Uso:
 *   APP_BASE_URL=https://easytripsaas.com node scripts/post-deploy-check.mjs
 *   node scripts/post-deploy-check.mjs https://easytripsaas.com
 */

const arg = process.argv[2];
const base = (process.env.APP_BASE_URL || arg || "").replace(/\/$/, "");

if (!base) {
  console.error(
    "Imposta APP_BASE_URL oppure: node scripts/post-deploy-check.mjs <url>",
  );
  process.exit(2);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "follow",
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

async function main() {
  console.log(`Post-deploy check → ${base}\n`);

  const home = await fetch(base, { method: "GET", redirect: "follow" });
  if (!home.ok) {
    console.error(`Homepage: FAIL HTTP ${home.status}`);
    process.exit(1);
  }
  console.log(`Homepage: OK (${home.status})`);

  const healthUrl = `${base}/api/health`;
  const { res, body } = await fetchJson(healthUrl);
  if (!res.ok || !body?.ok) {
    console.error(`Health: FAIL HTTP ${res.status}`, body);
    process.exit(1);
  }
  console.log("Health:", JSON.stringify(body, null, 0));

  if (body.inngest && !body.inngest.configured) {
    console.warn(
      "\nWarning: Inngest keys non rilevate su questo deploy (INNGEST_*).",
    );
    console.warn(
      "Configura in Vercel e verifica la sync su dashboard Inngest.\n",
    );
  }

  console.log("\nPost-deploy check completato con successo.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
