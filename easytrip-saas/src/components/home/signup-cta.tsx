"use client";

import { SignUpButton } from "@clerk/nextjs";

type Props = {
  className: string;
  children: React.ReactNode;
};

/**
 * CTA stile bottone che apre il modal di registrazione Clerk.
 */
export function SignupCtaButton(props: Props) {
  return (
    <SignUpButton mode="modal" forceRedirectUrl="/app">
      <button type="button" className={props.className}>
        {props.children}
      </button>
    </SignUpButton>
  );
}
