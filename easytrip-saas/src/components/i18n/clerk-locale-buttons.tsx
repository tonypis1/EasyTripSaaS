"use client";

import { SignInButton, SignUpButton, useAuth, useClerk } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import {
  cloneElement,
  isValidElement,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AppLocale } from "@/i18n/routing";
import {
  accountPortalUrlWithReturn,
  clerkAccountPortalSignInPageUrl,
  clerkAccountPortalSignUpPageUrl,
} from "@/lib/clerk-account-portal-urls";

/**
 * Bottoni Accedi / Registrati / Inizia ora.
 *
 * In produzione con Account Portal su **altro host**, se `clerk-js` non arriva a
 * inizializzarsi (`useAuth().isLoaded` resta false), in passato i bottoni restavano
 * `disabled` e il click non faceva nulla. Qui:
 * - **non** disabilitiamo più in base a `isLoaded`;
 * - se sono impostate `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN` o `NEXT_PUBLIC_CLERK_SIGN_*_URL`,
 *   usiamo navigazione diretta `window.location` verso il portal con `redirect_url` (documentato da Clerk).
 */

type CommonProps = {
  appPath?: string;
  children: React.ReactNode;
};

type ClickableChildProps = {
  onClick?: (e: ReactMouseEvent) => void;
  disabled?: boolean;
};

function withLocale(path: string, locale: AppLocale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

function absoluteReturnUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function mergeClickableChild(
  children: ReactNode,
  onActivate: () => void,
): ReactNode {
  if (!isValidElement(children)) return children;
  const el = children as ReactElement<ClickableChildProps>;
  return cloneElement(el, {
    onClick: (e: ReactMouseEvent) => {
      el.props.onClick?.(e);
      onActivate();
    },
  });
}

export function SignInLocaleButton(
  props: CommonProps & { mode?: "modal" | "redirect" },
) {
  const locale = useLocale() as AppLocale;
  const targetPath = withLocale(props.appPath ?? "/app", locale);
  const mode = props.mode ?? "redirect";
  const clerk = useClerk();
  const { isLoaded } = useAuth();

  if (mode === "modal") {
    return (
      <SignInButton
        mode="modal"
        forceRedirectUrl={absoluteReturnUrl(targetPath)}
      >
        {props.children}
      </SignInButton>
    );
  }

  const after = () => {
    const url = absoluteReturnUrl(targetPath);
    const portal = clerkAccountPortalSignInPageUrl();
    if (portal) {
      window.location.assign(accountPortalUrlWithReturn(portal, url));
      return;
    }
    if (!isLoaded) return;
    void clerk.redirectToSignIn({
      signInForceRedirectUrl: url,
      signUpForceRedirectUrl: url,
    });
  };

  return mergeClickableChild(props.children, after);
}

export function SignUpLocaleButton(
  props: CommonProps & { mode?: "modal" | "redirect" },
) {
  const locale = useLocale() as AppLocale;
  const targetPath = withLocale(props.appPath ?? "/app", locale);
  const mode = props.mode ?? "redirect";
  const clerk = useClerk();
  const { isLoaded } = useAuth();

  if (mode === "modal") {
    return (
      <SignUpButton
        mode="modal"
        forceRedirectUrl={absoluteReturnUrl(targetPath)}
      >
        {props.children}
      </SignUpButton>
    );
  }

  const after = () => {
    const url = absoluteReturnUrl(targetPath);
    const portal = clerkAccountPortalSignUpPageUrl();
    if (portal) {
      window.location.assign(accountPortalUrlWithReturn(portal, url));
      return;
    }
    if (!isLoaded) return;
    void clerk.redirectToSignUp({
      signUpForceRedirectUrl: url,
      signInForceRedirectUrl: url,
    });
  };

  return mergeClickableChild(props.children, after);
}
