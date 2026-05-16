/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    viewTransition: true,
  },
  turbopack: {
    resolveAlias: {
      "@vercel/og": "./src/lib/og-stub.ts",
    },
  },
};

export default nextConfig;
