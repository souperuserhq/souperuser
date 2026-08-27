import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site, served from Cloudflare Workers static assets
  output: "export",
};

export default nextConfig;
