"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

export function UserButtonClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <UserButton afterSignOutUrl="/" />;
}
