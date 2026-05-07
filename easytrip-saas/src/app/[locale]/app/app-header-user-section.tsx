"use client";

import { UserButton } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/hooks/use-is-client";

export function AppHeaderUserSection({
  reservedAreaLabel,
}: {
  reservedAreaLabel: string;
}) {
  const isClient = useIsClient();

  return (
    <div className="flex shrink-0 items-center gap-3">
      <Link
        href="/app"
        className="text-et-ink/80 hover:text-et-ink hidden text-sm sm:inline"
      >
        {reservedAreaLabel}
      </Link>
      {isClient ? (
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-9 w-9",
            },
          }}
        />
      ) : (
        <div
          className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-b from-violet-400/45 to-violet-700/55"
          aria-hidden
        />
      )}
    </div>
  );
}
