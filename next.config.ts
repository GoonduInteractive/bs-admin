import type { NextConfig } from "next";

// The API is the admin's only data: there is no stand-in, so a dev server or
// build without it stops here, plainly. Locally, copy `.env.example` to `.env.local`.
if (!process.env.BS_API_URL) {
  throw new Error("BS_API_URL is not set. Copy .env.example to .env.local, and set it in the host's environment to deploy.");
}

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
