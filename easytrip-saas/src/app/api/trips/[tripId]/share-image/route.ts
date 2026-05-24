import { ImageResponse } from "next/og";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";
import { getShareCardLabels } from "@/lib/share-card/share-card-labels";
import { getShareCardLogoDataUrl } from "@/lib/share-card/share-card-assets";
import { getShareCardBackgroundPhotos } from "@/lib/share-card/share-card-photos";
import { getShareCardFonts } from "@/lib/share-card/share-card-fonts";
import {
  ShareCardView,
  type ShareCardFormat,
} from "@/lib/share-card/share-card-view";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseFormat(value: string | null): ShareCardFormat {
  return value === "social" ? "social" : "story";
}

function getDimensions(format: ShareCardFormat) {
  return format === "story"
    ? { width: 1080, height: 1920 }
    : { width: 1200, height: 630 };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale");
    const format = parseFormat(url.searchParams.get("format"));
    const { width, height } = getDimensions(format);

    const data = await container.services.tripService.getShareCardData(tripId);
    const labels = getShareCardLabels(locale);
    const [logoUrl, fonts, backgroundPhotos] = await Promise.all([
      getShareCardLogoDataUrl(),
      getShareCardFonts(),
      getShareCardBackgroundPhotos(data.destination),
    ]);

    const imageResponse = new ImageResponse(
      ShareCardView({
        destination: data.destination,
        geoScore: data.geoScore,
        labels,
        logoUrl,
        format,
        backgroundPhotos,
      }),
      {
        width,
        height,
        fonts,
      },
    );

    imageResponse.headers.set(
      "Cache-Control",
      "private, max-age=3600, stale-while-revalidate=86400",
    );

    return imageResponse;
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("[share-image] generation failed", error);
    return new Response("Impossibile generare la card di condivisione", {
      status: 500,
    });
  }
}
