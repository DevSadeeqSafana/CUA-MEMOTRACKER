import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives inside a folder holding sibling projects; without an
  // explicit root Turbopack may pick the parent directory and fail to
  // resolve packages from ./node_modules.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Google Identity Services signs in through a popup that reports
          // back with postMessage; the default COOP would block that.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
