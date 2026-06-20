import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /**
   * Turbopack configuration (Next.js 16+ default bundler).
   *
   * - `root` explicitly sets the project root so Turbopack doesn't
   *   get confused by a parent-level package-lock.json and emit a
   *   workspace-root warning.
   * - The empty config block itself silences the "webpack config but
   *   no turbopack config" error.
   *
   * pdfjs-dist uses a CDN worker URL at runtime, so no custom
   * module resolution rules are required here.
   */
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
