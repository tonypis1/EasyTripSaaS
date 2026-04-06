"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento invito...</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Link non valido
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold
                       hover:bg-blue-700 transition-colors cursor-pointer
                       min-h-[44px] min-w-[44px]"
          >
            Torna alla home
          </button>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sei dentro!
          </h1>
          <p className="text-gray-600">
            Ti sei unito al viaggio a{" "}
            <strong>{trip?.destination}</strong>. Redirect in corso...
          </p>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const isFull = trip.memberCount >= trip.maxMembers;
  const spotsLeft = trip.maxMembers - trip.memberCount;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold mb-1">Sei stato invitato!</h1>
          <p className="text-blue-100">
            {trip.organizerName} ti ha invitato a partecipare
          </p>
        </div>

        {/* Trip Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Destinazione</p>
              <p className="font-semibold text-gray-900 text-lg">
                {trip.destination}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
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
            <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Partecipanti</p>
              <p className="font-medium text-gray-900">
                {trip.memberCount} / {trip.maxMembers}{" "}
                {spotsLeft > 0 ? (
                  <span className="text-green-600 text-sm">
                    ({spotsLeft} {spotsLeft === 1 ? "posto" : "posti"} disponibil{spotsLeft === 1 ? "e" : "i"})
                  </span>
                ) : (
                  <span className="text-red-500 text-sm">(completo)</span>
                )}
              </p>
            </div>
          </div>

          {trip.style && (
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <span className="text-sm text-blue-700 font-medium">
                Stile: {trip.style}
              </span>
            </div>
          )}

          {/* Error inline */}
          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm text-center">
              {error}
            </div>
          )}

          {/* CTA */}
          {isFull ? (
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <p className="text-gray-600 font-medium">
                Il gruppo è al completo
              </p>
            </div>
          ) : !authLoaded ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !isSignedIn ? (
            <div className="space-y-3">
              <button
                onClick={() =>
                  clerk.redirectToSignIn({
                    afterSignInUrl: `/join/${token}`,
                    afterSignUpUrl: `/join/${token}`,
                  })
                }
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6
                           bg-gradient-to-r from-blue-600 to-indigo-600 text-white
                           rounded-xl font-semibold text-lg
                           hover:from-blue-700 hover:to-indigo-700
                           transition-all cursor-pointer min-h-[48px]"
              >
                <LogIn className="w-5 h-5" />
                Accedi per unirti
              </button>
              <p className="text-xs text-gray-500 text-center">
                Devi accedere o creare un account per unirti al viaggio.
              </p>
            </div>
          ) : (
            <button
              onClick={onJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6
                         bg-gradient-to-r from-blue-600 to-indigo-600 text-white
                         rounded-xl font-semibold text-lg
                         hover:from-blue-700 hover:to-indigo-700
                         transition-all cursor-pointer
                         disabled:opacity-60 disabled:cursor-not-allowed
                         min-h-[48px]"
            >
              {joining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Accesso in corso...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Unisciti al viaggio
                </>
              )}
            </button>
          )}

          <p className="text-xs text-gray-400 text-center">
            Avrai accesso in sola lettura all&apos;itinerario e potrai partecipare
            allo split delle spese.
          </p>
        </div>
      </div>
    </div>
  );
}
