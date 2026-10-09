import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: path.join(projectDirectory, "../.."),
  transpilePackages: ["three", "@chofex/challenges-contract"],
  // Decks are compiled at build time from content/decks, which the route
  // reaches through fs reads — the one thing the tracer is not obliged to
  // follow. This pins the directory so it cannot be left out.
  //
  // Measured on Next 16.3.4 with `output: "standalone"`: today it is redundant.
  // Dropping this key entirely still left all 48 deck files in the standalone
  // output, so nothing currently depends on it. It stays as insurance, and the
  // key has to keep naming a real route — a key that matches nothing is not
  // insurance, it is a comment that reads like one.
  outputFileTracingIncludes: {
    "/deck/[...slug]": ["./content/decks/**/*"],
    "/api/v1/challenges/*/test": [
      "../../node_modules/quickjs-emscripten*/**/*",
      "../../node_modules/@jitl/quickjs-*/**/*",
    ],
  },
  async redirects() {
    return [
      {
        source: "/discord",
        destination: "https://discord.gg/PB5xZ9XYPJ",
        permanent: true,
      },
      // The English deck shipped at /deck/en before translations moved inside
      // the deck they translate. That link went out to devtools by email, and
      // an outreach link that 404s is worse than a stale one: there is nobody
      // to tell, and the recipient reads it as the event being gone.
      {
        source: "/deck/en",
        destination: "/deck/main/en",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/draco/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.blob.vercel-storage.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
