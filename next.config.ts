import type { NextConfig } from "next";

const strapiUrl = process.env.STRAPI_URL ? new URL(process.env.STRAPI_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/**",
      },
      ...(strapiUrl
        ? [
            {
              protocol: strapiUrl.protocol.replace(":", "") as "http" | "https",
              hostname: strapiUrl.hostname,
              port: strapiUrl.port || undefined,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
