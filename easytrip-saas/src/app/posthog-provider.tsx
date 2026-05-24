"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const PH_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef("");

  useEffect(() => {
    if (!PH_KEY) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    posthog.capture("$pageview", { $current_url: window.origin + url });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!PH_KEY) return;
    posthog.init(PH_KEY, {
      api_host: PH_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
    });
    setReady(true);
  }, []);

  if (!PH_KEY || !ready) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
