"use client";

import { UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  SignInLocaleButton,
  SignUpLocaleButton,
} from "@/components/i18n/clerk-locale-buttons";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { IconGlobe } from "./icons";

type Mode = "guest" | "authenticated";

export function HomeNavBar(props: { mode: Mode }) {
  const t = useTranslations("home.nav");
  const tCommon = useTranslations("common");

  return (
    <header className="border-et-border bg-et-deep/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="font-display text-et-accent inline-flex min-w-0 items-center gap-2 text-xl font-normal tracking-tight"
        >
          <IconGlobe className="text-et-accent h-7 w-7 shrink-0" />
          {tCommon("appName")}
        </Link>
        <nav className="text-et-ink/70 hidden items-center gap-5 text-sm md:flex">
          <Link
            href="/#come-funziona"
            className="hover:text-et-ink shrink-0"
            scroll
          >
            {t("howItWorks")}
          </Link>
          <Link href="/#prezzi" className="hover:text-et-ink shrink-0" scroll>
            {t("pricing")}
          </Link>
          <Link href="/#faq" className="hover:text-et-ink shrink-0" scroll>
            {t("faq")}
          </Link>
          {props.mode === "authenticated" ? (
            <Link
              href="/app/trips"
              className="hover:text-et-ink text-et-ink/90 shrink-0 font-medium"
            >
              {t("myTrips")}
            </Link>
          ) : null}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher variant="header" />
          {props.mode === "guest" ? (
            <>
              <SignInLocaleButton appPath="/app">
                <button
                  type="button"
                  className="text-et-ink/80 hover:text-et-ink hidden rounded-lg px-3 py-2 text-sm sm:inline"
                >
                  {t("signIn")}
                </button>
              </SignInLocaleButton>
              <SignUpLocaleButton appPath="/app">
                <button
                  type="button"
                  className="bg-et-accent text-et-accent-ink hover:bg-et-accent/88 rounded-xl px-4 py-2 text-sm font-semibold transition"
                >
                  {t("signUp")}
                </button>
              </SignUpLocaleButton>
            </>
          ) : (
            <>
              <Link
                href="/app"
                className="text-et-ink/80 hover:text-et-ink hidden text-sm sm:inline"
              >
                {t("reservedArea")}
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
