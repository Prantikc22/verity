import type { NextConfig } from "next";

// One product: marketing lives on qashifthq.com, this app is the workspace.
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://qashifthq.com";
// Temporary (307) until app.qashifthq.com is live and verified; then permanent.
const permanent = process.env.QASHIFT_MARKETING_REDIRECTS_PERMANENT === "1";

const nextConfig: NextConfig = {
  // Shared workspace package is published as raw TS; let Next transpile it.
  transpilePackages: ["@qashift/verity-core"],
  async redirects() {
    return [
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
