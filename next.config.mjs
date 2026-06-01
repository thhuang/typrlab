/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint runs as its own step (npm run lint / CI), not coupled to the build.
  eslint: { ignoreDuringBuilds: true },
  // Emit a fully static site to ./out (typr is client-only: localStorage, no
  // server/API routes), so it deploys to any static host — Cloudflare Pages,
  // Vercel, Netlify, GitHub Pages. `next build` writes the export directly.
  output: 'export',
};

export default nextConfig;
