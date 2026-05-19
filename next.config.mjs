/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nrsr.sk",
        port: "",
        pathname: "/web/**",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      "@vercel/og": "./src/lib/og-stub.ts",
    },
  },
};

export default nextConfig;
