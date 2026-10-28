import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/panel-location": ["./src/data/panel-locations/**/*.json"],
    "/api/panel/manual": ["./src/data/panel-locations/**/*.json"],
  },
};

export default nextConfig;
