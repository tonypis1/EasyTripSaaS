import { routing, type AppLocale } from "@/i18n/routing";

export type ShareCardLabels = {
  eyebrow: string;
  geoScoreLabel: string;
  outOfTen: string;
  tagline: string;
  website: string;
};

const LABELS: Record<AppLocale, ShareCardLabels> = {
  it: {
    eyebrow: "Il mio viaggio",
    geoScoreLabel: "GeoScore",
    outOfTen: "/10",
    tagline: "Itinerario AI ottimizzato",
    website: "easytripsaas.com",
  },
  en: {
    eyebrow: "My trip",
    geoScoreLabel: "GeoScore",
    outOfTen: "/10",
    tagline: "AI-optimized itinerary",
    website: "easytripsaas.com",
  },
  es: {
    eyebrow: "Mi viaje",
    geoScoreLabel: "GeoScore",
    outOfTen: "/10",
    tagline: "Itinerario optimizado con IA",
    website: "easytripsaas.com",
  },
  fr: {
    eyebrow: "Mon voyage",
    geoScoreLabel: "GeoScore",
    outOfTen: "/10",
    tagline: "Itinéraire optimisé par IA",
    website: "easytripsaas.com",
  },
  de: {
    eyebrow: "Meine Reise",
    geoScoreLabel: "GeoScore",
    outOfTen: "/10",
    tagline: "KI-optimierte Reiseroute",
    website: "easytripsaas.com",
  },
};

export function resolveShareCardLocale(
  locale: string | null | undefined,
): AppLocale {
  if (locale && routing.locales.includes(locale as AppLocale)) {
    return locale as AppLocale;
  }
  return routing.defaultLocale;
}

export function getShareCardLabels(
  locale: string | null | undefined,
): ShareCardLabels {
  return LABELS[resolveShareCardLocale(locale)];
}

export function formatShareCardGeoScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return rounded.toFixed(1);
}
