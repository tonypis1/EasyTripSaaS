"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

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
 * Pulsante di assistenza: Crisp (script e cookie) viene caricato solo al
 * primo click, cioè quando l'utente chiede il servizio. Prima veniva caricato
 * su ogni pagina dell'area riservata, impostando cookie senza alcuna
 * richiesta. Dopo il click Crisp mostra la propria bolla e questo pulsante
 * sparisce. Senza NEXT_PUBLIC_CRISP_WEBSITE_ID non viene mostrato nulla.
 */
export function CrispChat({ label }: { label: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!CRISP_ID || loaded) return null;

  return (
    <button
      type="button"
      onClick={() => {
        openCrispChat();
        setLoaded(true);
      }}
      aria-label={label}
      title={label}
      data-testid="crisp-open"
      className="bg-et-accent text-et-deep focus:ring-et-accent/50 fixed right-5 bottom-5 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus:ring-2 focus:outline-none"
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
    </button>
  );
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
