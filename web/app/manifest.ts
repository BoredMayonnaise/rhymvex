import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rhymvex Workspace",
    short_name: "Rhymvex",
    description: "Brand and product agency workspace & client portal",
    start_url: "/portal",
    id: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0B0F14",
    theme_color: "#0B0F14",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
