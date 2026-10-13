import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The Merch section was renamed Products; old links and bookmarks still land.
    return [
      { source: "/merch", destination: "/products", permanent: true },
      { source: "/merch/:path*", destination: "/products/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
