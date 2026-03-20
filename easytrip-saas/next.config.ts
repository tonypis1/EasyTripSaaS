import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consenti accesso da IP di rete in dev (es. da altro dispositivo sulla stessa rete)
  allowedDevOrigins: ["http://192.168.1.28:3000", "http://localhost:3000"],
};

export default nextConfig;
