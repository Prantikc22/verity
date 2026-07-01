import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace package is published as raw TS; let Next transpile it.
  transpilePackages: ["@qashift/verity-core"],
};

export default nextConfig;
