import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lan = Object.values(networkInterfaces()).flat().find(i => i?.family === "IPv4" && !i.internal)?.address ?? "localhost";

const nextConfig: NextConfig = {
  allowedDevOrigins: [lan],
  env: { NEXT_PUBLIC_LAN: lan },
};

export default nextConfig;
