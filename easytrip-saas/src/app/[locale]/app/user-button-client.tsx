"use client";

import { useSyncExternalStore } from "react";
import { UserButton } from "@clerk/nextjs";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function UserButtonClient() {
  const isClient = useIsClient();
  if (!isClient) return null;
  return <UserButton afterSignOutUrl="/" />;
}
