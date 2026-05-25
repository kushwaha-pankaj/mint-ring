import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repo root has its own package-lock.json; without this, Turbopack picks BCU-Demo
// as the workspace root and breaks relative CSS imports in src/app/globals.css.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  // Allow opening the dev site from either localhost or 127.0.0.1 without
  // breaking HMR (which would otherwise break React hydration on the demo
  // machine if reviewers use either origin).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const api = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
