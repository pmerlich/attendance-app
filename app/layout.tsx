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
  // Must match manifest.webmanifest's theme_color - this drives the browser chrome/task-switcher
  // color, the manifest value drives the installed-PWA splash/status-bar color; they used to
  // disagree (blue here, green there).
  themeColor: "#1e7a59",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}