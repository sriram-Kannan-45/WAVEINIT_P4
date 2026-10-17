import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Next's development React stream uses the HMR socket. Permit this machine's
// current LAN addresses so network previews hydrate just like localhost.
const lanDevOrigins = [
  ...new Set(
    Object.values(networkInterfaces()).flatMap((interfaces) =>
      (interfaces ?? [])
        .filter((network) => !network.internal && network.family === "IPv4")
        .flatMap((network) => [
          network.address,
          `${network.address}:3000`,
          `${network.address}:3001`,
        ]),
    ),
  ),
];

const config: NextConfig = {
  allowedDevOrigins: lanDevOrigins,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    dangerouslyAllowLocalIP: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ddhcgtnxshwlqipgziro.supabase.co",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/test/Pics/:path*",
        destination: "/test/pics/:path*",
      },
    ];
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
        source: "/pic/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
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
