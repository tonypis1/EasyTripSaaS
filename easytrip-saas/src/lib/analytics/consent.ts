/**
 * Consenso ai cookie di analisi (PostHog), richiesto prima di attivarli
 * (linee guida del Garante privacy sui cookie, 2021). Memorizzare la scelta
 * dell'utente è un trattamento tecnico: non richiede a sua volta consenso.
 *
 * La scelta vale 6 mesi: poi il banner ricompare. Le linee guida chiedono di
 * non riproporlo prima di 6 mesi dopo un rifiuto.
 */

export type AnalyticsConsent = "granted" | "denied";

export const CONSENT_STORAGE_KEY = "easytrip_analytics_consent_v1";
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;

/** Evento DOM emesso quando la scelta cambia (detail: AnalyticsConsent). */
export const CONSENT_CHANGE_EVENT = "easytrip:consent-change";
/** Evento DOM per riaprire il banner (link "Preferenze cookie"). */
export const CONSENT_REOPEN_EVENT = "easytrip:consent-reopen";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * Scelta valida salvata, o null (nessuna scelta, scaduta, illeggibile o
 * storage non disponibile: in tutti questi casi il banner va mostrato).
 */
export function readConsent(
  storage: StorageLike | null,
  now: number,
): AnalyticsConsent | null {
  if (!storage) return null;
  let stored: string | null;
  try {
    stored = storage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as { value?: unknown; at?: unknown };
    if (parsed.value !== "granted" && parsed.value !== "denied") return null;
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) {
      return null;
    }
    if (now - parsed.at > CONSENT_MAX_AGE_MS || parsed.at > now) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

/** Salva la scelta; false se lo storage non è disponibile (vale solo per la pagina aperta). */
export function writeConsent(
  storage: StorageLike | null,
  value: AnalyticsConsent,
  now: number,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ value, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** Gli analytics partono solo se configurati e con il consenso esplicito. */
export function shouldStartAnalytics(
  consent: AnalyticsConsent | null,
  configured: boolean,
): boolean {
  return configured && consent === "granted";
}

/** localStorage del browser, o null (server, navigazione privata, storage bloccato). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Scelta fatta nella pagina aperta: vale anche se lo storage non è
 * disponibile (navigazione privata, storage bloccato), fino al reload.
 */
let pageChoice: AnalyticsConsent | null = null;

/** Scelta corrente (snapshot per `useSyncExternalStore`). */
export function currentConsent(): AnalyticsConsent | null {
  return readConsent(browserStorage(), Date.now()) ?? pageChoice;
}

/** Notifica i cambi di scelta, anche da un'altra scheda (evento `storage`). */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Salva la scelta e la notifica al provider degli analytics e al banner. */
export function setAnalyticsConsent(value: AnalyticsConsent): void {
  pageChoice = value;
  writeConsent(browserStorage(), value, Date.now());
  window.dispatchEvent(
    new CustomEvent<AnalyticsConsent>(CONSENT_CHANGE_EVENT, { detail: value }),
  );
}

/** Riapre il banner per cambiare la scelta. */
export function reopenConsentBanner(): void {
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}
