import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "kakeibo",
    short_name: "kakeibo",
    description: "個人的な家計簿アプリ",
    start_url: "/",
    background_color: "#f7f5ef",
    theme_color: "#18392b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 円形などに切り抜かれても硬貨が欠けないよう、中央に余白を取った同じ画像を使います。
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
