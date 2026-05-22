import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("app.notFound");

  return (
    <div className="bg-et-deep text-et-ink mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-et-accent text-sm font-semibold">EasyTripSaaS</p>
        <h1 className="font-display mt-2 text-3xl tracking-tight">
          {t("title")}
        </h1>
        <p className="text-et-ink/70 mt-3 text-sm leading-relaxed">
          {t.rich("bodyDetail", {
            mono: (chunks) => (
              <span className="text-et-ink font-mono">{chunks}</span>
            ),
          })}
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link
            href="/"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            {t("linkHome")}
          </Link>
        </li>
        <li>
          <Link
            href="/app"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            {t("linkDashboard")}
          </Link>
        </li>
        <li>
          <Link
            href="/app/trips"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            {t("linkTrips")}
          </Link>
        </li>
      </ul>
      <p className="text-et-ink/50 text-xs">
        {t.rich("devHint", {
          mono: (chunks) => <span className="font-mono">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
