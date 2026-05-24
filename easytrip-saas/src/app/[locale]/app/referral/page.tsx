"use client";

import { useEffect, useState, useCallback } from "react";
import posthog from "posthog-js";
import { useLocale, useTranslations } from "next-intl";
import {
  Gift,
  Copy,
  CheckCircle2,
  Users,
  UserCheck,
  CreditCard,
  Loader2,
  Share2,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";
import { localeToBcp47 } from "@/lib/trip-display-labels";

type ReferralItem = {
  id: string;
  referredEmail: string;
  referredName: string | null;
  status: string;
  rewardGranted: boolean;
  createdAt: string;
  convertedAt: string | null;
};

type ReferralData = {
  referralCode: string;
  referralUrl: string;
  total: number;
  signedUp: number;
  converted: number;
  earnedCents: number;
  referrals: ReferralItem[];
};

const STATUS_STYLE: Record<
  string,
  {
    color: string;
    icon: typeof Clock;
    labelKey: "pending" | "signed_up" | "converted";
  }
> = {
  pending: {
    labelKey: "pending",
    color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
    icon: Clock,
  },
  signed_up: {
    labelKey: "signed_up",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: UserCheck,
  },
  converted: {
    labelKey: "converted",
    color: "text-green-400 bg-green-400/10 border-green-400/20",
    icon: CheckCircle2,
  },
};

export default function ReferralPage() {
  const locale = useLocale();
  const t = useTranslations("app.referral");
  const dateLocale = localeToBcp47(locale);
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/referral");
      const json = await res.json();
      if (res.ok && json.data) setData(json.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function onCopy() {
    if (!data) return;
    navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    posthog.capture("referral_link_copied");
    setTimeout(() => setCopied(false), 2500);
  }

  async function onShare() {
    if (!data) return;
    posthog.capture("referral_link_shared");
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("share.title"),
          text: t("share.text"),
          url: data.referralUrl,
        });
      } catch {
        onCopy();
      }
    } else {
      onCopy();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-et-accent h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-et-ink/50 py-24 text-center">{t("loadError")}</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">
          {t.rich("subtitle", {
            strong: (chunks) => (
              <strong className="text-et-ink">{chunks}</strong>
            ),
          })}
        </p>
      </div>

      <section className="border-et-border rounded-2xl border bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
            <Gift className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display text-et-ink text-lg">
              {t("inviteLinkTitle")}
            </h2>
            <p className="text-et-ink/55 text-sm">{t("inviteLinkHint")}</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="bg-et-deep border-et-border text-et-ink/70 flex-1 truncate rounded-xl border px-4 py-3 font-mono text-sm">
            {data.referralUrl}
          </div>
          <button
            onClick={onCopy}
            className="flex h-12 min-h-[44px] w-12 min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
            title={t("copyLinkTitle")}
          >
            {copied ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => void onShare()}
            className="flex h-12 min-h-[44px] w-12 min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-purple-600 text-white transition-colors hover:bg-purple-700"
            title={t("shareLinkTitle")}
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {copied && (
          <p className="text-sm font-medium text-green-400">
            {t("linkCopied")}
          </p>
        )}

        <div className="bg-et-card/50 border-et-border/50 mt-4 rounded-xl border p-4">
          <p className="text-et-ink/60 text-sm leading-relaxed">
            <Sparkles className="-mt-0.5 mr-1 inline h-4 w-4 text-amber-400" />
            {t.rich("howItWorks", {
              strong: (chunks) => (
                <strong className="text-et-ink/80">{chunks}</strong>
              ),
            })}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t("stats.invited"),
            value: data.total,
            icon: Users,
            color: "text-blue-400 bg-blue-400/10",
          },
          {
            label: t("stats.signedUp"),
            value: data.signedUp,
            icon: UserCheck,
            color: "text-indigo-400 bg-indigo-400/10",
          },
          {
            label: t("stats.converted"),
            value: data.converted,
            icon: CreditCard,
            color: "text-green-400 bg-green-400/10",
          },
          {
            label: t("stats.earned"),
            value: `€${(data.earnedCents / 100).toFixed(2)}`,
            icon: Gift,
            color: "text-amber-400 bg-amber-400/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-et-border bg-et-card rounded-xl border p-4 text-center"
          >
            <div
              className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-et-ink text-2xl font-bold">{stat.value}</p>
            <p className="text-et-ink/50 mt-1 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="border-et-border bg-et-card rounded-2xl border p-5 sm:p-6">
        <h3 className="font-display text-et-ink mb-4 text-base">
          {t("yourInvites")}
        </h3>

        {data.referrals.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="text-et-ink/15 mx-auto mb-3 h-10 w-10" />
            <p className="text-et-ink/40 text-sm">{t("emptyInvites")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r) => {
              const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
              const Icon = st.icon;
              return (
                <div
                  key={r.id}
                  className="bg-et-bg/40 border-et-border/50 flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-400">
                      {(r.referredName ?? r.referredEmail)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-et-ink truncate text-sm font-medium">
                        {r.referredName ?? r.referredEmail}
                      </p>
                      <p className="text-et-ink/40 text-xs">
                        {new Date(r.createdAt).toLocaleDateString(dateLocale)}
                        {r.convertedAt && (
                          <>
                            {" "}
                            <ArrowRight className="inline h-3 w-3" />{" "}
                            {new Date(r.convertedAt).toLocaleDateString(
                              dateLocale,
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${st.color}`}
                    >
                      <Icon className="h-3 w-3" />
                      {t(`status.${st.labelKey}`)}
                    </span>
                    {r.rewardGranted && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                        {t("rewardBadge")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
