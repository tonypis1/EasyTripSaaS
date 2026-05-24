import type { ShareCardLabels } from "@/lib/share-card/share-card-labels";
import { formatShareCardGeoScore } from "@/lib/share-card/share-card-labels";

export type ShareCardFormat = "story" | "social";

export type ShareCardViewProps = {
  destination: string;
  geoScore: number;
  labels: ShareCardLabels;
  logoUrl: string;
  format: ShareCardFormat;
  backgroundPhotos?: string[];
};

const COLORS = {
  bg: "#0B1120",
  card: "#111827",
  cyan: "#4FC3F7",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.72)",
};

function getDimensions(format: ShareCardFormat) {
  return format === "story"
    ? { width: 1080, height: 1920, isStory: true }
    : { width: 1200, height: 630, isStory: false };
}

function BackgroundPhotos({
  photos,
  format,
}: {
  photos: string[];
  format: ShareCardFormat;
}) {
  if (photos.length === 0) return null;

  const isStory = format === "story";

  if (photos.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img
      <img
        src={photos[0]}
        alt=""
        width={isStory ? 1080 : 1200}
        height={isStory ? 1920 : 630}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    );
  }

  if (isStory) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img */}
        <img
          src={photos[0]}
          alt=""
          width={1080}
          height={960}
          style={{ width: "100%", height: "50%", objectFit: "cover" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img */}
        <img
          src={photos[1]}
          alt=""
          width={1080}
          height={960}
          style={{ width: "100%", height: "50%", objectFit: "cover" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img */}
      <img
        src={photos[0]}
        alt=""
        width={600}
        height={630}
        style={{ width: "50%", height: "100%", objectFit: "cover" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img */}
      <img
        src={photos[1]}
        alt=""
        width={600}
        height={630}
        style={{ width: "50%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

export function ShareCardView({
  destination,
  geoScore,
  labels,
  logoUrl,
  format,
  backgroundPhotos = [],
}: ShareCardViewProps) {
  const { width, height, isStory } = getDimensions(format);
  const scoreText = formatShareCardGeoScore(geoScore);
  const padding = isStory ? 72 : 48;
  const logoSize = isStory ? 120 : 88;
  const scoreSize = isStory ? 168 : 112;
  const destinationSize = isStory ? 52 : 40;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        position: "relative",
        fontFamily: "Manrope",
        overflow: "hidden",
      }}
    >
      <BackgroundPhotos photos={backgroundPhotos} format={format} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            backgroundPhotos.length > 0
              ? "linear-gradient(180deg, rgba(11, 17, 32, 0.45) 0%, rgba(11, 17, 32, 0.82) 55%, rgba(11, 17, 32, 0.92) 100%)"
              : "transparent",
          display: "flex",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: padding / 2,
          left: padding / 2,
          right: padding / 2,
          bottom: padding / 2,
          border: `3px solid ${COLORS.cyan}`,
          borderRadius: isStory ? 40 : 28,
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isStory ? 20 : 12,
          }}
        >
          <div
            style={{
              color: COLORS.cyan,
              fontSize: isStory ? 22 : 16,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {labels.eyebrow}
          </div>
          <div
            style={{
              color: COLORS.white,
              fontSize: destinationSize,
              fontWeight: 800,
              lineHeight: 1.1,
              maxWidth: isStory ? 900 : 760,
            }}
          >
            {destination}
          </div>
          <div
            style={{
              color: COLORS.muted,
              fontSize: isStory ? 24 : 18,
              fontWeight: 700,
            }}
          >
            {labels.tagline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: isStory ? 1 : 0,
            marginTop: isStory ? 0 : 8,
            marginBottom: isStory ? 0 : 8,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: COLORS.card,
              border: `2px solid rgba(79, 195, 247, 0.35)`,
              borderRadius: isStory ? 32 : 24,
              padding: isStory ? "40px 64px" : "24px 48px",
            }}
          >
            <div
              style={{
                color: COLORS.cyan,
                fontSize: isStory ? 20 : 14,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: isStory ? 12 : 8,
              }}
            >
              {labels.geoScoreLabel}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  color: COLORS.white,
                  fontSize: scoreSize,
                  fontWeight: 800,
                  fontFamily: "Manrope",
                  lineHeight: 1,
                }}
              >
                {scoreText}
              </span>
              <span
                style={{
                  color: COLORS.muted,
                  fontSize: isStory ? 36 : 24,
                  fontWeight: 700,
                }}
              >
                {labels.outOfTen}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isStory ? 20 : 14,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori OG renderer requires native img */}
            <img
              src={logoUrl}
              alt="EasyTrip"
              width={logoSize}
              height={logoSize}
              style={{ borderRadius: "50%" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  color: COLORS.white,
                  fontSize: isStory ? 28 : 20,
                  fontWeight: 800,
                }}
              >
                EasyTrip
              </div>
              <div
                style={{
                  color: COLORS.muted,
                  fontSize: isStory ? 18 : 14,
                  fontWeight: 700,
                }}
              >
                SaaS
              </div>
            </div>
          </div>
          <div
            style={{
              color: COLORS.cyan,
              fontSize: isStory ? 24 : 18,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            {labels.website}
          </div>
        </div>
      </div>
    </div>
  );
}
