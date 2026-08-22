/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    outputFileTracingIncludes: {
      "*": [
        "./node_modules/.prisma/client/**",
        "./node_modules/@prisma/client/**",
      ],
    },
  },
};

export default nextConfig;
