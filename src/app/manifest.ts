import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BeautyPass",
    short_name: "BeautyPass",
    description: "Je beautyroutine in één membership: boek bij de beste salons van Amsterdam.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f2",
    theme_color: "#3a1828",
    lang: "nl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
