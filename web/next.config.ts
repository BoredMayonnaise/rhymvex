import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads go through server actions; the default 1 MB body limit was too
  // small for the files feature, which allows up to 10 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
