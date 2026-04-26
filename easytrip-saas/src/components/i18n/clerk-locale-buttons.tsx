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

/**
 * Wrapper dei bottoni Clerk che calcola la destinazione post-auth dal locale.
 *
 * Per Account Portal su **altro host** (es. `accounts.easytripsaas.com` vs `easytripsaas.com`)
 * usiamo `useClerk().redirectToSignUp` / `redirectToSignIn` con URL **assoluti**
 * (`window.location.origin` + path). I componenti `<SignUpButton mode="redirect">` a volte
 * non navigano in questo scenario; il metodo sul Clerk object segue la config Dashboard.
 *
 * `mode="modal"` resta sui componenti Clerk ufficiali (iframe; richiede CSP adeguata).
 */

type CommonProps = {
  /** Path applicativo SENZA prefisso locale, es. "/app" o `/join/${token}`. */
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

/** URL assoluto per il ritorno dopo auth (cross-subdomain / Account Portal). */
function absoluteReturnUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function mergeClickableChild(
  children: ReactNode,
  onActivate: () => void,
  extraDisabled: boolean,
): ReactNode {
  if (!isValidElement(children)) return children;
  const el = children as ReactElement<ClickableChildProps>;
  return cloneElement(el, {
    disabled: Boolean(el.props.disabled) || extraDisabled,
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
    if (!isLoaded) return;
    const url = absoluteReturnUrl(targetPath);
    void clerk.redirectToSignIn({
      signInForceRedirectUrl: url,
      signUpForceRedirectUrl: url,
    });
  };

  return mergeClickableChild(props.children, after, !isLoaded);
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
    if (!isLoaded) return;
    const url = absoluteReturnUrl(targetPath);
    void clerk.redirectToSignUp({
      signUpForceRedirectUrl: url,
      signInForceRedirectUrl: url,
    });
  };

  return mergeClickableChild(props.children, after, !isLoaded);
}
