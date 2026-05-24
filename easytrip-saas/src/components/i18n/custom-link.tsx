/**
 * CustomLink = re-export di `Link` da `src/i18n/navigation.ts`.
 *
 * Questo file esiste per chiarezza di intent in feature che vogliono un nome
 * "parlante" (`<CustomLink href="/app/trips" />`) pur delegando tutto il
 * comportamento locale-aware a next-intl.
 *
 * Importalo così:
 *   import { CustomLink } from "@/components/i18n/custom-link";
 *
 * Oppure, equivalentemente, direttamente dall'helper navigation:
 *   import { Link as CustomLink } from "@/i18n/navigation";
 *
 * Entrambi aggiungono automaticamente il prefisso `/it`, `/en`, ecc.
 */
export { Link as CustomLink } from "@/i18n/navigation";
