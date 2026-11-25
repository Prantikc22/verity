import type { NextConfig } from "next";

// One product: marketing lives on qashifthq.com, this app is the workspace.
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://qashifthq.com";
// Temporary (307) until app.qashifthq.com is live and verified; then permanent.
const permanent = process.env.QASHIFT_MARKETING_REDIRECTS_PERMANENT === "1";

// Security headers. The workspace loads Razorpay checkout, Supabase and PostHog,
// so the CSP here locks framing, plugins and base/form targets without
// enumerating every script origin.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Shared workspace package is published as raw TS; let Next transpile it.
  transpilePackages: ["@qashift/verity-core"],
  async redirects() {
    // Old hosts forward browsers to app.qashifthq.com. /api stays on every host so
    // published reporters, CLIs and webhooks that post to the old URL keep working.
    const OLD_HOSTS = ["verity.qashifthq.com", "verity-kappa-ebon.vercel.app"];
    const hostMoves = OLD_HOSTS.map((value) => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host" as const, value }],
      destination: "https://app.qashifthq.com/:path",
      permanent: false,
    }));
    return [
      ...hostMoves,
      { source: "/", destination: "/dashboard", permanent: false },
      // Keep /pricing?checkout=… working: existing upgrade links and Razorpay checkout start there.
      { source: "/pricing", missing: [{ type: "query", key: "checkout" }], destination: `${MARKETING}/pricing`, permanent },
      { source: "/solutions", destination: `${MARKETING}/testing`, permanent },
      { source: "/solutions/:slug*", destination: `${MARKETING}/testing`, permanent },
      { source: "/compare/:path*", destination: `${MARKETING}/compare`, permanent },
    ];
  },
};

export default nextConfig;
