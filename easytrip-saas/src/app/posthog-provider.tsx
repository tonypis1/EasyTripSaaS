"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  currentConsent,
  shouldStartAnalytics,
  subscribeConsent,
} from "@/lib/analytics/consent";
import {
  POSTHOG_INIT_OPTIONS,
  POSTHOG_KEY,
} from "@/lib/analytics/posthog-options";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef("");

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    posthog.capture("$pageview", { $current_url: window.origin + url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * PostHog solo con il consenso ai cookie di analisi. Senza `init` le chiamate
 * `posthog.capture` sparse nei componenti non inviano nulla e non salvano
 * nulla nel browser. Revocare il consenso ferma l'invio e cancella
 * l'identificativo salvato.
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const consent = useSyncExternalStore(
    subscribeConsent,
    currentConsent,
    () => null,
  );
  const enabled = shouldStartAnalytics(consent, Boolean(POSTHOG_KEY));
  const [loaded, setLoaded] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (enabled) {
      if (initialized.current) {
        posthog.opt_in_capturing();
      } else {
        initialized.current = true;
        posthog.init(POSTHOG_KEY, {
          ...POSTHOG_INIT_OPTIONS,
          loaded: () => setLoaded(true),
        });
      }
    } else if (initialized.current) {
      posthog.opt_out_capturing();
      posthog.reset();
    }
  }, [enabled]);

  if (!enabled || !loaded) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
