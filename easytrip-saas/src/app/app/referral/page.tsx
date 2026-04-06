"use client";

import { useEffect, useState, useCallback } from "react";
import posthog from "posthog-js";
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

const STATUS_MAP: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: "In attesa",
    color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
    icon: Clock,
  },
  signed_up: {
    label: "Registrato",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: UserCheck,
  },
  converted: {
    label: "Convertito",
    color: "text-green-400 bg-green-400/10 border-green-400/20",
    icon: CheckCircle2,
  },
};

export default function ReferralPage() {
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
          title: "EasyTrip — Viaggia gratis!",
          text: "Registrati su EasyTrip con il mio link e ricevi un itinerario AI personalizzato!",
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
        <Loader2 className="h-8 w-8 animate-spin text-et-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-et-ink/50">
        Impossibile caricare i dati referral.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-l-2 border-et-accent/40 pl-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-et-accent/88">
          Programma Referral
        </p>
        <h1 className="font-display mt-2 text-3xl font-normal tracking-tight text-et-ink sm:text-4xl">
          Invita un amico, viaggia gratis
        </h1>
        <p className="mt-2 max-w-xl text-sm text-et-ink/65">
          Per ogni amico che si registra e acquista il primo viaggio, ricevi
          <strong className="text-et-ink"> €9,99 di credito</strong> = 1 trip gratis.
        </p>
      </div>

      {/* Hero Card con link */}
      <section className="rounded-2xl border border-et-border bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
            <Gift className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display text-lg text-et-ink">Il tuo link di invito</h2>
            <p className="text-sm text-et-ink/55">Condividilo con amici, social, ovunque!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 rounded-xl bg-et-deep border border-et-border px-4 py-3 font-mono text-sm text-et-ink/70 truncate">
            {data.referralUrl}
          </div>
          <button
            onClick={onCopy}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                       bg-indigo-600 text-white hover:bg-indigo-700
                       transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            title="Copia link"
          >
            {copied ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => void onShare()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                       bg-purple-600 text-white hover:bg-purple-700
                       transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            title="Condividi"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {copied && (
          <p className="text-sm text-green-400 font-medium">Link copiato negli appunti!</p>
        )}

        <div className="mt-4 rounded-xl bg-et-card/50 border border-et-border/50 p-4">
          <p className="text-sm text-et-ink/60 leading-relaxed">
            <Sparkles className="inline h-4 w-4 text-amber-400 mr-1 -mt-0.5" />
            <strong className="text-et-ink/80">Come funziona:</strong> Il tuo amico
            clicca il link → si registra → acquista un viaggio → tu ricevi
            automaticamente €9,99 di credito. Nessun limite di inviti!
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Invitati",
            value: data.total,
            icon: Users,
            color: "text-blue-400 bg-blue-400/10",
          },
          {
            label: "Registrati",
            value: data.signedUp,
            icon: UserCheck,
            color: "text-indigo-400 bg-indigo-400/10",
          },
          {
            label: "Convertiti",
            value: data.converted,
            icon: CreditCard,
            color: "text-green-400 bg-green-400/10",
          },
          {
            label: "Guadagnato",
            value: `€${(data.earnedCents / 100).toFixed(2)}`,
            icon: Gift,
            color: "text-amber-400 bg-amber-400/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-et-border bg-et-card p-4 text-center"
          >
            <div
              className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-et-ink">{stat.value}</p>
            <p className="text-xs text-et-ink/50 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Lista referral */}
      <section className="rounded-2xl border border-et-border bg-et-card p-5 sm:p-6">
        <h3 className="font-display text-base text-et-ink mb-4">I tuoi inviti</h3>

        {data.referrals.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-et-ink/15 mx-auto mb-3" />
            <p className="text-sm text-et-ink/40">
              Nessun invito ancora. Condividi il tuo link per iniziare!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r) => {
              const st = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
              const Icon = st.icon;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-et-bg/40 border border-et-border/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-bold shrink-0">
                      {(r.referredName ?? r.referredEmail).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-et-ink truncate">
                        {r.referredName ?? r.referredEmail}
                      </p>
                      <p className="text-xs text-et-ink/40">
                        {new Date(r.createdAt).toLocaleDateString("it-IT")}
                        {r.convertedAt && (
                          <>
                            {" "}
                            <ArrowRight className="inline h-3 w-3" />{" "}
                            {new Date(r.convertedAt).toLocaleDateString("it-IT")}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${st.color}`}
                    >
                      <Icon className="h-3 w-3" />
                      {st.label}
                    </span>
                    {r.rewardGranted && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                        +€9,99
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
