import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GYM",
    short_name: "GYM",
    description: "Registo de treino e programa privado para dois.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-PT",
    background_color: "#0e0f0e",
    theme_color: "#0e0f0e",
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
