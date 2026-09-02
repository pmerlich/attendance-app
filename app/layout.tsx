import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מנהל עבודה | פרויקטים, שעות וכספים",
  description: "מערכת לניהול עבודות שטח, שעות עובדים וכספי פרויקטים.",
  icons: { icon: "/app-icon.png", apple: "/app-icon.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2457d6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}