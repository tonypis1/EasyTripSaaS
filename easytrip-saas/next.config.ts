import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaderList } from "./src/lib/security-headers";

// Collega next-intl al file src/i18n/request.ts (caricatore dei messaggi per locale).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev: Playwright usa spesso 127.0.0.1:3000; senza questo Next 16 blocca /_next/* e Clerk può fallire.
  allowedDevOrigins: [
    "http://192.168.1.28:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaderList,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
