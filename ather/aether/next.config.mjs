/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // allow the sandboxed preview host to talk to the dev server
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai', 'localhost'],
};

export default nextConfig;
