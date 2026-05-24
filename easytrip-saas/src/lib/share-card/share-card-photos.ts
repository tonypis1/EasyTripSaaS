const PHOTO_COUNT = 2;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 15000;
const THUMB_WIDTH = 640;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 400;

type WikimediaImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
};

type WikimediaPage = {
  title?: string;
  imageinfo?: WikimediaImageInfo[];
};

type PhotoCacheEntry = {
  photos: string[];
  expiresAt: number;
};

const photoCache = new Map<string, PhotoCacheEntry>();

function extractCity(destination: string): string {
  const trimmed = destination.trim();
  if (!trimmed) return "travel";
  const [city] = trimmed.split(",");
  return (city ?? trimmed).trim();
}

function buildSearchQueries(destination: string): string[] {
  const city = extractCity(destination);
  const queries = [`${city} landmark`, `${city} travel`];
  if (city !== destination.trim()) {
    queries.push(`${destination.trim()} landmark`);
  }
  return queries;
}

function isUsablePhoto(title: string, info: WikimediaImageInfo): boolean {
  const lower = title.toLowerCase();
  if (
    lower.includes(" map ") ||
    lower.includes("map of") ||
    lower.includes("flag") ||
    lower.includes("logo") ||
    lower.includes("icon") ||
    lower.includes("coat of arms") ||
    lower.includes("diagram") ||
    lower.includes(".svg")
  ) {
    return false;
  }

  const mime = info.mime ?? "";
  if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png")) {
    return false;
  }

  const width = info.width ?? 0;
  const height = info.height ?? 0;
  return width >= MIN_WIDTH && height >= MIN_HEIGHT;
}

async function searchWikimediaUrls(query: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: String(THUMB_WIDTH),
    format: "json",
    origin: "*",
  });

  const res = await fetch(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikimediaPage> };
  };

  const pages = Object.values(data.query?.pages ?? {});
  const urls: string[] = [];

  for (const page of pages) {
    const title = page.title ?? "";
    const info = page.imageinfo?.[0];
    if (!info || !isUsablePhoto(title, info)) continue;
    const url = info.thumburl ?? info.url;
    if (url) urls.push(url);
  }

  return urls;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 10_000) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function resolvePhotoDataUrls(destination: string): Promise<string[]> {
  const seen = new Set<string>();
  const candidateUrls: string[] = [];

  for (const query of buildSearchQueries(destination)) {
    const urls = await searchWikimediaUrls(query, 8);
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      candidateUrls.push(url);
      if (candidateUrls.length >= PHOTO_COUNT + 2) break;
    }
    if (candidateUrls.length >= PHOTO_COUNT + 2) break;
  }

  const dataUrls = await Promise.all(
    candidateUrls.slice(0, PHOTO_COUNT + 2).map((url) => urlToDataUrl(url)),
  );

  return dataUrls.filter((url): url is string => url !== null).slice(0, PHOTO_COUNT);
}

export async function getShareCardBackgroundPhotos(
  destination: string,
): Promise<string[]> {
  const cacheKey = destination.trim().toLowerCase();
  const cached = photoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.photos;
  }

  try {
    const photos = await resolvePhotoDataUrls(destination);
    photoCache.set(cacheKey, {
      photos,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return photos;
  } catch (error) {
    console.warn("[share-card-photos] failed for destination", destination, error);
    return [];
  }
}
