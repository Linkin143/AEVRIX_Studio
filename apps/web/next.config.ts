import type { NextConfig } from "next";
const config: NextConfig = { distDir: ".next-build", transpilePackages: ["@aevrix/shared-types"], reactStrictMode: true };
export default config;
