"use client";

import { useEffect } from "react";

const CRISP_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "";
const CRISP_SCRIPT_SRC = "https://client.crisp.chat/l.js";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

/**
 * Inizializza la coda Crisp e carica l.js se mancante.
 * Deve essere chiamabile in modo sincrono (es. onClick) prima che useEffect del layout abbia girato.
 */
function ensureCrispClient(): boolean {
  if (typeof window === "undefined" || !CRISP_ID) return false;

  window.$crisp = window.$crisp ?? [];
  window.CRISP_WEBSITE_ID = CRISP_ID;

  if (!document.querySelector(`script[src="${CRISP_SCRIPT_SRC}"]`)) {
    const s = document.createElement("script");
    s.src = CRISP_SCRIPT_SRC;
    s.async = true;
    document.head.appendChild(s);
  }

  return true;
}

/**
 * Initializes Crisp live chat widget.
 * If NEXT_PUBLIC_CRISP_WEBSITE_ID is not set, nothing is rendered.
 */
export function CrispChat() {
  useEffect(() => {
    ensureCrispClient();
  }, []);

  return null;
}

/**
 * Opens the Crisp chat box programmatically.
 * Useful for "Hai bisogno di aiuto?" buttons.
 */
export function openCrispChat(message?: string) {
  if (!ensureCrispClient()) return;

  try {
    (window.$crisp as unknown[]).push(["do", "chat:open"]);
    // Invia il testo dopo che la finestra è in coda di apertura (evita race con l.js).
    if (message) {
      const q = window.$crisp as unknown[];
      window.setTimeout(() => {
        try {
          q.push(["do", "message:send", ["text", message]]);
        } catch {
          /* noop */
        }
      }, 400);
    }
  } catch {
    // Crisp not loaded yet — i push restano in coda per quando l.js è pronto
  }
}

export function isCrispEnabled(): boolean {
  return Boolean(CRISP_ID);
}
