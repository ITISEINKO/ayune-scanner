import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/panel-location": ["./src/data/panel-locations/**/*.json"],
  },
};

export default nextConfig;
