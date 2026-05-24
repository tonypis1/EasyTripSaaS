"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  LogIn,
  MapPin,
  Calendar,
  Users,
  UserPlus,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Plane,
  RefreshCw,
} from "lucide-react";
import { localeToBcp47 } from "@/lib/trip-display-labels";

const CLERK_LOAD_TIMEOUT_MS = 8000;

function buildSignInPortalUrl(returnPath: string): string | null {
  const fullSignIn = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL?.trim();
  const portalOrigin =
    process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN?.trim();
  const baseUrl =
    fullSignIn ||
    (portalOrigin ? `${portalOrigin.replace(/\/$/, "")}/sign-in` : null);
  if (!baseUrl) return null;
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:") return null;
    const absoluteReturn =
      typeof window !== "undefined"
        ? new URL(returnPath, window.location.origin).toString()
        : returnPath;
    u.searchParams.set("redirect_url", absoluteReturn);
    return u.toString();
  } catch {
    return null;
  }
}

type TripPreview = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  style: string | null;
  organizerName: string;
  memberCount: number;
  maxMembers: number;
};

function formatTripDate(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function JoinTripPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("join");
  const dateLocale = localeToBcp47(locale);
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();

  const [trip, setTrip] = useState<TripPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/join/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? t("invalidLink"));
          return;
        }
        setTrip(json.data);
      })
      .catch(() => setError(t("networkError")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoaded) return;
    const id = setTimeout(() => {
      setAuthTimedOut(true);
    }, CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [authLoaded]);

  const signInFallbackUrl = useMemo(
    () => buildSignInPortalUrl(`/${locale}/join/${token}`),
    [locale, token],
  );

  async function onJoin() {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${token}`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? t("joinFailed"));
        return;
      }

      setJoined(true);
      const tripId = json.data?.tripId;
      setTimeout(() => {
        router.push(tripId ? `/app/trips/${tripId}` : "/app/trips");
      }, 2000);
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-xl font-bold text-gray-900">
            {t("invalidTitle")}
          </h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="min-h-[44px] min-w-[44px] cursor-pointer rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {t("backHome")}
          </button>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            {t("joinedTitle")}
          </h1>
          <p className="text-gray-600">
            {t.rich("joinedBody", {
              destination: trip?.destination ?? "",
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const isFull = trip.memberCount >= trip.maxMembers;
  const spotsLeft = trip.maxMembers - trip.memberCount;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center text-white">
          <Plane className="mx-auto mb-3 h-10 w-10 opacity-90" />
          <h1 className="mb-1 text-2xl font-bold">{t("invitedTitle")}</h1>
          <p className="text-blue-100">
            {t("invitedSubtitle", { organizerName: trip.organizerName })}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">{t("destinationLabel")}</p>
              <p className="text-lg font-semibold text-gray-900">
                {trip.destination}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">{t("datesLabel")}</p>
              <p className="font-medium text-gray-900">
                {formatTripDate(trip.startDate, dateLocale)} →{" "}
                {formatTripDate(trip.endDate, dateLocale)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">{t("participantsLabel")}</p>
              <p className="font-medium text-gray-900">
                {trip.memberCount} / {trip.maxMembers}{" "}
                {spotsLeft > 0 ? (
                  <span className="text-sm text-green-600">
                    {spotsLeft === 1
                      ? t("spotsOne", { count: spotsLeft })
                      : t("spotsMany", { count: spotsLeft })}
                  </span>
                ) : (
                  <span className="text-sm text-red-500">{t("groupFull")}</span>
                )}
              </p>
            </div>
          </div>

          {trip.style && (
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <span className="text-sm font-medium text-blue-700">
                {t("styleLabel", { style: trip.style })}
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          {isFull ? (
            <div className="rounded-xl bg-gray-100 p-4 text-center">
              <p className="font-medium text-gray-600">
                {t("groupFullMessage")}
              </p>
            </div>
          ) : !authLoaded ? (
            authTimedOut ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-900">
                      {t("authTimeoutTitle")}
                    </p>
                  </div>
                  <p className="text-xs text-amber-800">
                    {t("authTimeoutBody")}
                  </p>
                </div>
                {signInFallbackUrl && (
                  <a
                    href={signInFallbackUrl}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700"
                  >
                    <LogIn className="h-5 w-5" />
                    {t("signInPortal")}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("reloadPage")}
                </button>
              </div>
            ) : (
              <div className="flex justify-center py-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            )
          ) : !isSignedIn ? (
            <div className="space-y-3">
              <button
                onClick={() =>
                  clerk.redirectToSignIn({
                    afterSignInUrl: `/${locale}/join/${token}`,
                    afterSignUpUrl: `/${locale}/join/${token}`,
                  })
                }
                className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700"
              >
                <LogIn className="h-5 w-5" />
                {t("signInCta")}
              </button>
              <p className="text-center text-xs text-gray-500">
                {t("signInHint")}
              </p>
            </div>
          ) : (
            <button
              onClick={onJoin}
              disabled={joining}
              className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("joining")}
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  {t("joinCta")}
                </>
              )}
            </button>
          )}

          <p className="text-center text-xs text-gray-400">{t("footerNote")}</p>
        </div>
      </div>
    </div>
  );
}
