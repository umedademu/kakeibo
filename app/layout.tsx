import type { Metadata } from "next";
import "./globals.css";

const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  metadataBase: new URL(
    productionDomain ? `https://${productionDomain}` : "http://localhost:3000",
  ),
  title: "kakeibo",
  description: "個人的な家計簿アプリ",
  openGraph: {
    title: "kakeibo",
    description: "個人的な家計簿アプリ",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1728,
        height: 909,
        alt: "kakeibo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "kakeibo",
    description: "個人的な家計簿アプリ",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
