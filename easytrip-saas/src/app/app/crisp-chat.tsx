"use client";

import { useEffect } from "react";

const CRISP_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

/**
 * Initializes Crisp live chat widget.
 * If NEXT_PUBLIC_CRISP_WEBSITE_ID is not set, nothing is rendered.
 */
export function CrispChat() {
  useEffect(() => {
    if (!CRISP_ID || typeof window === "undefined") return;
    if (window.$crisp) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_ID;

    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);

    return () => {
      s.remove();
    };
  }, []);

  return null;
}

/**
 * Opens the Crisp chat box programmatically.
 * Useful for "Hai bisogno di aiuto?" buttons.
 */
export function openCrispChat(message?: string) {
  if (typeof window === "undefined" || !window.$crisp) return;

  try {
    (window.$crisp as unknown[]).push(["do", "chat:open"]);
    if (message) {
      (window.$crisp as unknown[]).push([
        "do",
        "message:send",
        ["text", message],
      ]);
    }
  } catch {
    // Crisp not loaded yet
  }
}

export function isCrispEnabled(): boolean {
  return Boolean(CRISP_ID);
}
