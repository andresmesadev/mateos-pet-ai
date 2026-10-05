import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep verification builds separate from the user's running dev server.
  distDir: process.env.NEXT_VERIFY_BUILD === "1" ? ".next/verification" : ".next",
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
