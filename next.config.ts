import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBase =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (process.env.GITHUB_ACTIONS && repoName ? `/${repoName}` : "");

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  trailingSlash: true,
  basePath: pagesBase || undefined,
  assetPrefix: pagesBase || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
