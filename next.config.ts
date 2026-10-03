import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Next's development React stream uses the HMR socket. Permit this machine's
// current LAN addresses so network previews hydrate just like localhost.
const lanDevOrigins = [
  ...new Set(
    Object.values(networkInterfaces()).flatMap((interfaces) =>
      (interfaces ?? [])
        .filter((network) => !network.internal && network.family === "IPv4")
        .map((network) => network.address),
    ),
  ),
];

const config: NextConfig = {
  allowedDevOrigins: lanDevOrigins,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/intro/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
