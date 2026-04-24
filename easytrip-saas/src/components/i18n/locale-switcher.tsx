"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Local switcher con bandierine (emoji).
 *
 * Non usiamo `<select>` nativo: su Windows le opzioni spesso non mostrano le emoji
 * e `text-transform: uppercase` rompe le bandierine (Regional Indicators → "IT").
 * Il menu custom mostra sempre emoji + nome lingua.
 *
 * Navigazione: `getPathname` + `window.location.assign` (vedi commenti in git).
 */

const FLAGS: Record<AppLocale, string> = {
  it: "🇮🇹",
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
};

type Variant = "header" | "footer" | "menu";

type Props = {
  variant?: Variant;
  className?: string;
};

function navigateToLocale(next: AppLocale, pathname: string) {
  const href = getPathname({
    href: pathname,
    locale: next,
    forcePrefix: true,
  });
  if (typeof document !== "undefined") {
    const ck = routing.localeCookie;
    if (typeof ck === "object" && ck !== null) {
      document.cookie = `${ck.name}=${next};path=/;max-age=${ck.maxAge}`;
    }
  }

  void fetch("/api/user/language", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: next }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});

  window.location.assign(href);
}

export function LocaleSwitcher({ variant = "header", className }: Props) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const t = useTranslations("locale.switcher");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function onPick(next: AppLocale) {
    setOpen(false);
    if (next === locale) return;
    navigateToLocale(next, pathname);
  }

  const baseClasses =
    variant === "footer"
      ? "border-et-border bg-transparent text-et-ink/70 hover:text-et-ink text-xs"
      : variant === "menu"
        ? "border-et-border bg-et-card text-et-ink text-sm"
        : "border-et-border bg-et-deep/60 text-et-ink/80 hover:text-et-ink text-xs sm:text-sm";

  return (
    <div ref={rootRef} className={`relative inline-block ${className ?? ""}`}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${baseClasses}`}
      >
        <button
          type="button"
          className="inline-flex min-h-[1.5rem] cursor-pointer items-center gap-1.5 bg-transparent pr-0.5 text-left font-medium normal-case outline-none"
          aria-label={t("label")}
          aria-expanded={open ? "true" : "false"}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden className="text-base leading-none">
            {FLAGS[locale]}
          </span>
          <span className="max-w-[8rem] truncate sm:max-w-none">
            {t(locale)}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          className="border-et-border bg-et-card text-et-ink absolute right-0 z-[60] mt-1.5 min-w-[11rem] rounded-xl border py-1 shadow-lg"
          role="listbox"
          aria-label={t("label")}
        >
          {routing.locales.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === locale ? "true" : "false"}
                className="hover:bg-et-ink/[0.06] flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium normal-case"
                onClick={() => onPick(code)}
              >
                <span className="text-base leading-none" aria-hidden>
                  {FLAGS[code]}
                </span>
                <span>{t(code)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
