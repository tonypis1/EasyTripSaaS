import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IconGlobe } from "@/components/home/icons";
import { AppHeaderUserSection } from "./app-header-user-section";
import { CrispChat } from "./crisp-chat";
import { ReferralTracker } from "@/app/referral-tracker";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("app.nav");
  const tCommon = await getTranslations("common");

  return (
    <div className="bg-et-deep text-et-ink min-h-screen">
      <header className="border-et-border bg-et-deep/90 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="font-display text-et-accent inline-flex min-w-0 items-center gap-2 text-lg font-normal tracking-tight"
          >
            <IconGlobe className="text-et-accent h-7 w-7 shrink-0" />
            {tCommon("appName")}
          </Link>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              href="/app/trips"
              className="text-et-ink/65 hover:text-et-accent text-sm transition-colors duration-200"
            >
              {t("myTrips")}
            </Link>
            <Link
              href="/app/referral"
              className="text-et-ink/65 hover:text-et-accent text-sm transition-colors duration-200"
            >
              {t("inviteFriends")}
            </Link>
            <Link
              href="/app/account/privacy"
              className="text-et-ink/65 hover:text-et-accent text-sm transition-colors duration-200"
            >
              {t("privacy")}
            </Link>
            <AppHeaderUserSection reservedAreaLabel={t("reservedArea")} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">{children}</main>
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>
      <CrispChat />
    </div>
  );
}
