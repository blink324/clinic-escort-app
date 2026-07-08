import type { Metadata, Viewport } from "next";
import { ScrollToTop } from "@/components/ScrollToTop";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clinic-tsukisoi.jp"),
  title: "つきそい",
  description: "親や高齢家族の通院予定を共有し、誰が付き添うかを決めるWebアプリ",
  applicationName: "つきそい",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "つきそい"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: "/home-icon.png",
    apple: "/home-icon.png"
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "つきそい",
    description: "家族の通院予定と付き添い担当を、ひとつに。",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "つきそい"
      }
    ],
    locale: "ja_JP",
    siteName: "つきそい",
    type: "website",
    url: "https://www.clinic-tsukisoi.jp"
  },
  twitter: {
    card: "summary_large_image",
    title: "つきそい",
    description: "家族の通院予定と付き添い担当を、ひとつに。",
    images: ["/og-image.svg"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6fec"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
