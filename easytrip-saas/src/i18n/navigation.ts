import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Wrapper "locale-aware" di Next.js navigation:
 * - Link: sostituisce next/link aggiungendo automaticamente /{locale} ai path interni.
 * - redirect / usePathname / useRouter / getPathname: versioni consapevoli del locale.
 *
 * Usa SEMPRE questi export al posto di next/link o next/navigation per le rotte localizzate.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
