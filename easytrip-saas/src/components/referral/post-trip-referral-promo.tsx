"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Copy,
  Gift,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
const REWARD_AMOUNT = "3.99";

type Props = {
  variant: "banner" | "hero";
  referralUrl?: string | null;
  className?: string;
};

export function PostTripReferralPromo({
  variant,
  referralUrl: referralUrlProp,
  className,
}: Props) {
  const t = useTranslations("app.trips.postTripReferral");
  const tRef = useTranslations("app.referral");
  const [referralUrl, setReferralUrl] = useState<string | null>(
    referralUrlProp ?? null,
  );
  const [loadingUrl, setLoadingUrl] = useState(!referralUrlProp);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (referralUrlProp) {
      setReferralUrl(referralUrlProp);
      setLoadingUrl(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referral");
        const json = (await res.json()) as {
          data?: { referralUrl?: string };
        };
        if (!cancelled && res.ok && json.data?.referralUrl) {
          setReferralUrl(json.data.referralUrl);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referralUrlProp]);

  const onCopy = useCallback(() => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralUrl]);

  const onShare = useCallback(async () => {
    if (!referralUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: tRef("share.title"),
          text: tRef("share.text"),
          url: referralUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      onCopy();
    }
  }, [referralUrl, tRef, onCopy]);

  const amount = REWARD_AMOUNT;

  if (variant === "banner") {
    return (
      <div
        className={`border-et-accent/25 from-et-accent/8 via-et-accent/4 overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent ${className ?? ""}`}
      >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="border-et-accent/30 bg-et-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <Gift className="text-et-accent h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-et-ink text-sm font-semibold">
                {t("bannerTitle", { amount })}
              </p>
              <p className="text-et-ink/55 mt-0.5 text-xs leading-relaxed">
                {t("bannerSubtitle", { amount })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/app/referral"
              className="text-et-accent hover:text-et-accent/80 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
            >
              {t("ctaDetails")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onCopy}
              disabled={loadingUrl || !referralUrl}
              className="border-et-border bg-et-card text-et-ink hover:border-et-accent/30 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loadingUrl ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : copied ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? tRef("linkCopied") : t("copyLink")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-et-accent/25 from-et-accent/10 via-et-accent/5 overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent ${className ?? ""}`}
    >
      <div className="px-6 py-6 sm:px-8">
        <div className="flex items-start gap-4">
          <div className="border-et-accent/30 bg-et-accent/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border">
            <Gift className="text-et-accent h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-et-accent/80 text-xs font-semibold tracking-widest uppercase">
              {t("heroEyebrow")}
            </p>
            <h2 className="text-et-ink mt-1 text-lg font-medium sm:text-xl">
              {t("heroTitle", { amount })}
            </h2>
            <p className="text-et-ink/55 mt-2 text-sm leading-relaxed">
              {t("heroSubtitle", { amount })}
            </p>
            <p className="text-et-ink/40 mt-2 text-xs">{t("windowHint")}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCopy}
            disabled={loadingUrl || !referralUrl}
            className="border-et-border bg-et-card text-et-ink hover:border-et-accent/30 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? tRef("linkCopied") : t("copyLink")}
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={loadingUrl || !referralUrl}
            className="border-et-accent/30 bg-et-accent/10 text-et-accent hover:bg-et-accent/20 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            {tRef("shareLinkTitle")}
          </button>
        </div>

        <Link
          href="/app/referral"
          className="text-et-accent hover:text-et-accent/80 mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          {t("ctaDashboard")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
