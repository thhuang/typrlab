/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint runs as its own step (npm run lint / CI), not coupled to the build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
