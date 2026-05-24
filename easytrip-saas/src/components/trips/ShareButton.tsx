"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { Loader2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";

type ShareButtonProps = {
  tripId: string;
  destination: string;
  geoScore: number;
  locale: AppLocale;
};

function slugifyDestination(destination: string): string {
  return destination
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildShareImageUrl(
  tripId: string,
  locale: AppLocale,
  format: "story" | "social" = "story",
): string {
  const params = new URLSearchParams({
    locale,
    format,
  });
  return `/api/trips/${tripId}/share-image?${params.toString()}`;
}

function buildHomepageUrl(locale: AppLocale): string {
  if (typeof window === "undefined") {
    return `https://easytripsaas.com/${locale}`;
  }
  return `${window.location.origin}/${locale}`;
}

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Mobile/tablet: native share sheet. Desktop: direct file download. */
function prefersNativeFileShare(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const touchNarrow =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(max-width: 900px)").matches;

  return mobileUa || touchNarrow;
}

export function ShareButton({
  tripId,
  destination,
  geoScore,
  locale,
}: ShareButtonProps) {
  const t = useTranslations("app.trips.detail.shareCard");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const cachedBlobRef = useRef<Blob | null>(null);

  const shareImageUrl = useMemo(
    () => buildShareImageUrl(tripId, locale, "story"),
    [tripId, locale],
  );
  const homepageUrl = useMemo(() => buildHomepageUrl(locale), [locale]);
  const downloadName = useMemo(
    () => `easytrip-${slugifyDestination(destination) || "trip"}.png`,
    [destination],
  );

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2500);
  }, []);

  const fetchShareImageBlob = useCallback(async (): Promise<Blob> => {
    if (cachedBlobRef.current) {
      return cachedBlobRef.current;
    }

    const loadOnce = async (): Promise<Blob> => {
      const res = await fetch(shareImageUrl, { credentials: "include" });
      if (!res.ok) {
        throw new Error(t("errorGeneric"));
      }
      return res.blob();
    };

    try {
      const blob = await loadOnce();
      cachedBlobRef.current = blob;
      return blob;
    } catch {
      const blob = await loadOnce();
      cachedBlobRef.current = blob;
      return blob;
    }
  }, [shareImageUrl, t]);

  useEffect(() => {
    let cancelled = false;

    fetch(shareImageUrl, { credentials: "include" })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!cancelled && blob) {
          cachedBlobRef.current = blob;
        }
      })
      .catch(() => {
        /* prefetch is best-effort */
      });

    return () => {
      cancelled = true;
    };
  }, [shareImageUrl]);

  const copyHomepageLink = useCallback(async () => {
    await navigator.clipboard.writeText(homepageUrl);
    posthog.capture("trip_share_link_copied", {
      trip_id: tripId,
      locale,
      destination,
      geo_score: geoScore,
    });
    showFeedback(t("linkCopied"));
  }, [destination, geoScore, homepageUrl, locale, showFeedback, t, tripId]);

  const downloadImage = useCallback(
    async (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      posthog.capture("trip_share_card_downloaded", {
        trip_id: tripId,
        locale,
        destination,
        geo_score: geoScore,
      });
      showFeedback(t("downloadDone"));
    },
    [destination, downloadName, geoScore, locale, showFeedback, t, tripId],
  );

  const shareNative = useCallback(
    async (blob: Blob) => {
      const file = new File([blob], downloadName, { type: "image/png" });
      const sharePayload = {
        title: t("shareTitle", { destination }),
        text: t("shareText", { destination, score: geoScore.toFixed(1) }),
        url: homepageUrl,
        files: [file],
      };

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare(sharePayload)
      ) {
        try {
          await navigator.share(sharePayload);
          posthog.capture("trip_share_card_shared", {
            trip_id: tripId,
            locale,
            destination,
            geo_score: geoScore,
            method: "native_file",
          });
          return;
        } catch (err) {
          if (isShareCancelled(err)) return;
          throw err;
        }
      }

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: sharePayload.title,
            text: sharePayload.text,
            url: sharePayload.url,
          });
          posthog.capture("trip_share_card_shared", {
            trip_id: tripId,
            locale,
            destination,
            geo_score: geoScore,
            method: "native_link",
          });
          return;
        } catch (err) {
          if (isShareCancelled(err)) return;
        }
      }

      await downloadImage(blob);
      try {
        await copyHomepageLink();
      } catch {
        /* download already succeeded; clipboard may be blocked */
      }
    },
    [
      copyHomepageLink,
      destination,
      downloadImage,
      downloadName,
      geoScore,
      homepageUrl,
      locale,
      t,
      tripId,
    ],
  );

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);

    try {
      const blob = await fetchShareImageBlob();

      if (prefersNativeFileShare()) {
        await shareNative(blob);
        return;
      }

      await downloadImage(blob);
    } catch (err) {
      if (isShareCancelled(err)) return;
      showFeedback(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }, [busy, downloadImage, fetchShareImageBlob, shareNative, showFeedback, t]);

  const statusMessage = busy ? t("preparing") : feedback;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={busy}
        aria-label={t("buttonLabel")}
        title={t("buttonLabel")}
        className="border-et-accent/30 bg-et-accent/10 text-et-accent hover:bg-et-accent/16 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span>{t("buttonLabel")}</span>
      </button>
      {statusMessage ? (
        <span className="text-et-accent text-xs font-medium">
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}
