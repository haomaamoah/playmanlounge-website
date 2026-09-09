export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Static export with a GitHub Pages base path does not rewrite `next/image`
 * srcs for unoptimized images, so public asset URLs are prefixed here.
 */
export function asset(path: string) {
  if (!basePath) return path;
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}
