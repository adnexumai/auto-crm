import type { NextConfig } from "next";

const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
const basePath =
  rawBasePath && rawBasePath !== "/"
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
    : "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
