import type { NextConfig } from "next";
import { securityHeaderList } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Consenti accesso da IP di rete in dev (es. da altro dispositivo sulla stessa rete)
  allowedDevOrigins: ["http://192.168.1.28:3000", "http://localhost:3000"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaderList,
      },
    ];
  },
};

export default nextConfig;
