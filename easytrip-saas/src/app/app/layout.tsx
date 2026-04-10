import { Suspense } from "react";
import Link from "next/link";
import { UserButtonClient } from "./user-button-client";
import { CrispChat } from "./crisp-chat";
import { ReferralTracker } from "@/app/referral-tracker";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-et-deep text-et-ink min-h-screen">
      <header className="border-et-border bg-et-deep/90 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-4 py-4">
          <Link
            href="/app"
            className="font-display text-et-accent text-lg font-normal tracking-tight"
          >
            EasyTrip
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/app/trips"
              className="text-et-ink/65 hover:text-et-accent text-sm transition-colors duration-200"
            >
              I miei viaggi
            </Link>
            <Link
              href="/app/referral"
              className="text-et-ink/65 hover:text-et-accent text-sm transition-colors duration-200"
            >
              Invita amici
            </Link>
            <UserButtonClient />
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
