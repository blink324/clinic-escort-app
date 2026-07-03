import type { Metadata, Viewport } from "next";
import { ScrollToTop } from "@/components/ScrollToTop";
import "./styles.css";

export const metadata: Metadata = {
  title: "家族の付き添い調整",
  description: "親や高齢家族の通院予定を共有し、誰が付き添うかを決めるWebアプリ"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eaf7f2"
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
