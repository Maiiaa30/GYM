import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GYM",
    short_name: "GYM",
    description: "Private training log and programme for two.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c0a",
    theme_color: "#0b0c0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
