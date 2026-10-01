import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeNavBar } from "@/components/home/home-nav";
import { MarketingFooter } from "@/components/home/footer";
import { config } from "@/config/unifiedConfig";

type PageProps = { params: Promise<{ locale: string }> };

type Row = Record<string, string>;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
  };
}

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-et-ink mt-10 mb-3 text-xl">{heading}</h2>
      <div className="text-et-ink/75 space-y-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/**
 * Tabella su schermi larghi; su mobile ogni riga diventa una scheda
 * (etichetta: valore), senza scorrimento orizzontale.
 */
function Table({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: Row[];
}) {
  const [first, ...rest] = columns;
  return (
    <>
      <ul className="space-y-3 sm:hidden">
        {rows.map((row, i) => (
          <li
            key={i}
            className="border-et-border bg-et-card rounded-lg border px-3 py-2.5"
          >
            <p className="text-et-ink font-medium">{row[first.key]}</p>
            <dl className="mt-1.5 space-y-1">
              {rest.map((c) => (
                <div key={c.key}>
                  <dt className="text-et-ink/45 inline text-xs">{c.label}: </dt>
                  <dd className="inline">{row[c.key]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="border-et-border hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-et-card text-et-ink">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-et-border border-t align-top">
                {columns.map((c, j) => (
                  <td
                    key={c.key}
                    className={j === 0 ? "text-et-ink px-3 py-2" : "px-3 py-2"}
                  >
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Informativa privacy pubblica (artt. 13-14 GDPR). Testi in `legal.privacy`
 * nelle 5 lingue (prevale l'italiano); dati del titolare dalle variabili
 * LEGAL_* (vedi .env.example), con un avviso finché mancano.
 */
export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal.privacy");

  const { companyName, address, vatId, privacyEmail } = config.legal;
  const hasController = Boolean(companyName && address && vatId);

  const columns = (section: string, keys: string[]) =>
    keys.map((key) => ({ key, label: t(`${section}.columns.${key}`) }));

  return (
    <>
      <HomeNavBar mode="guest" />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-et-ink text-3xl">{t("title")}</h1>
        <p className="text-et-ink/50 mt-2 text-xs">{t("updated")}</p>
        <p className="text-et-ink/75 mt-6 text-sm leading-relaxed">
          {t("intro")}
        </p>
        <p className="text-et-ink/50 mt-2 text-xs">{t("languageNote")}</p>

        <Section id="titolare" heading={t("controller.heading")}>
          {hasController ? (
            <p>
              {t("controller.body", {
                company: companyName ?? "",
                address: address ?? "",
                vat: vatId ?? "",
              })}
            </p>
          ) : null}
          {privacyEmail ? (
            <p>
              {t.rich("controller.contact", {
                address: privacyEmail,
                email: (chunks) => (
                  <a
                    href={`mailto:${privacyEmail}`}
                    className="text-et-accent underline underline-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          ) : null}
          {!hasController || !privacyEmail ? (
            <p
              className="rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-amber-100/90"
              data-testid="privacy-controller-missing"
            >
              {t("controller.missing")}
            </p>
          ) : null}
        </Section>

        <Section id="dati" heading={t("data.heading")}>
          <Table
            columns={columns("data", ["data", "purpose", "basis"])}
            rows={t.raw("data.rows") as Row[]}
          />
          <p>{t("data.partners")}</p>
          <p>{t("data.ai")}</p>
        </Section>

        <Section id="preferenze" heading={t("preferences.heading")}>
          {(
            t.raw("preferences.paragraphs") as { title: string; text: string }[]
          ).map((p) => (
            <p key={p.title}>
              <strong className="text-et-ink">{p.title}</strong> {p.text}
            </p>
          ))}
        </Section>

        <Section id="cookie" heading={t("cookies.heading")}>
          <p>{t("cookies.lead")}</p>
          <Table
            columns={columns("cookies", ["name", "purpose", "type"])}
            rows={t.raw("cookies.rows") as Row[]}
          />
          <p>{t("cookies.change")}</p>
        </Section>

        <Section id="fornitori" heading={t("processors.heading")}>
          <p>{t("processors.lead")}</p>
          <Table
            columns={columns("processors", [
              "provider",
              "service",
              "data",
              "location",
            ])}
            rows={t.raw("processors.rows") as Row[]}
          />
          <p>{t("processors.transfers")}</p>
          <p>{t("processors.grounding")}</p>
        </Section>

        <Section id="conservazione" heading={t("retention.heading")}>
          <Table
            columns={columns("retention", ["data", "period"])}
            rows={t.raw("retention.rows") as Row[]}
          />
        </Section>

        <Section id="diritti" heading={t("rights.heading")}>
          <p>{t("rights.body")}</p>
          <p>{t("rights.portability")}</p>
          <p>{t("rights.contact")}</p>
          <p>{t("rights.complaint")}</p>
        </Section>

        <Section id="eta" heading={t("age.heading")}>
          <p>{t("age.body")}</p>
        </Section>

        <Section id="modifiche" heading={t("changes.heading")}>
          <p>{t("changes.body")}</p>
        </Section>
      </main>
      <MarketingFooter />
    </>
  );
}
