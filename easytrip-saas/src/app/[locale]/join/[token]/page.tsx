"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
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
} from "lucide-react";

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

export default function JoinTripPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();

  const [trip, setTrip] = useState<TripPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/join/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Link non valido");
          return;
        }
        setTrip(json.data);
      })
      .catch(() => setError("Errore di rete"))
      .finally(() => setLoading(false));
  }, [token]);

  async function onJoin() {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${token}`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Impossibile unirsi");
        return;
      }

      setJoined(true);
      const tripId = json.data?.tripId;
      setTimeout(() => {
        router.push(tripId ? `/app/trips/${tripId}` : "/app/trips");
      }, 2000);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-600">Caricamento invito...</p>
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
            Link non valido
          </h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="min-h-[44px] min-w-[44px] cursor-pointer rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Torna alla home
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
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Sei dentro!</h1>
          <p className="text-gray-600">
            Ti sei unito al viaggio a <strong>{trip?.destination}</strong>.
            Redirect in corso...
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center text-white">
          <Plane className="mx-auto mb-3 h-10 w-10 opacity-90" />
          <h1 className="mb-1 text-2xl font-bold">Sei stato invitato!</h1>
          <p className="text-blue-100">
            {trip.organizerName} ti ha invitato a partecipare
          </p>
        </div>

        {/* Trip Info */}
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Destinazione</p>
              <p className="text-lg font-semibold text-gray-900">
                {trip.destination}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium text-gray-900">
                {new Date(trip.startDate).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                →{" "}
                {new Date(trip.endDate).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Partecipanti</p>
              <p className="font-medium text-gray-900">
                {trip.memberCount} / {trip.maxMembers}{" "}
                {spotsLeft > 0 ? (
                  <span className="text-sm text-green-600">
                    ({spotsLeft} {spotsLeft === 1 ? "posto" : "posti"}{" "}
                    disponibil{spotsLeft === 1 ? "e" : "i"})
                  </span>
                ) : (
                  <span className="text-sm text-red-500">(completo)</span>
                )}
              </p>
            </div>
          </div>

          {trip.style && (
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <span className="text-sm font-medium text-blue-700">
                Stile: {trip.style}
              </span>
            </div>
          )}

          {/* Error inline */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          {/* CTA */}
          {isFull ? (
            <div className="rounded-xl bg-gray-100 p-4 text-center">
              <p className="font-medium text-gray-600">
                Il gruppo è al completo
              </p>
            </div>
          ) : !authLoaded ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
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
                Accedi per unirti
              </button>
              <p className="text-center text-xs text-gray-500">
                Devi accedere o creare un account per unirti al viaggio.
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
                  Accesso in corso...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Unisciti al viaggio
                </>
              )}
            </button>
          )}

          <p className="text-center text-xs text-gray-400">
            Avrai accesso in sola lettura all&apos;itinerario e potrai
            partecipare allo split delle spese.
          </p>
        </div>
      </div>
    </div>
  );
}
