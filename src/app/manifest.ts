import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and auto-linked by Next — this is what
// makes Hammerbid installable as an app: a real install on Android
// (standalone window, home-screen icon) and Add-to-Home-Screen on iPhone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hammerbid — Live Auction Marketplace",
    short_name: "Hammerbid",
    description:
      "Bid live, watch the price move, withdraw anytime before close.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0c0f14",
    theme_color: "#0c0f14",
    categories: ["shopping", "finance"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
