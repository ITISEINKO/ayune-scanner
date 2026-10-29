import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/panel-location": ["./src/data/panel-locations/**/*.json", "./context/LBY_PANEL_MAPPING.json"],
    "/cari-lokasi": ["./src/data/panel-locations/**/*.json", "./context/LBY_PANEL_MAPPING.json"],
    "/api/panel/manual": ["./src/data/panel-locations/**/*.json", "./context/LBY_PANEL_MAPPING.json"],
  },
};

export default nextConfig;
