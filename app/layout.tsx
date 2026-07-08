import type { Metadata, Viewport } from "next";
import { ScrollToTop } from "@/components/ScrollToTop";
import "./styles.css";

export const metadata: Metadata = {
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
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
  manifest: "/manifest.webmanifest"
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
