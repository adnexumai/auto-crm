const RAW_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();

export const BASE_PATH =
  RAW_BASE_PATH && RAW_BASE_PATH !== "/"
    ? `/${RAW_BASE_PATH.replace(/^\/+|\/+$/g, "")}`
    : "";

export function withBasePath(path: string) {
  if (!path) return BASE_PATH || "/";
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE_PATH) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}`;
}
