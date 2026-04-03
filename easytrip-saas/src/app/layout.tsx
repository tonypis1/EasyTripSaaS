import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist_Mono, Instrument_Serif, Manrope } from "next/font/google";
import PostHogProvider from "./posthog-provider";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EasyTrip — Itinerari AI per viaggi brevi",
  description: "Pianifica il tuo viaggio in 30 secondi con l'assistente AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="it">
        <body
          className={`${manrope.className} ${instrument.variable} ${manrope.variable} ${geistMono.variable} antialiased`}
        >
          <Suspense fallback={null}>
            <PostHogProvider>{children}</PostHogProvider>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
