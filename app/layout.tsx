import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "זמן־שטח | ניהול פרויקטים ושעות",
  description: "מערכת לניהול עבודות שטח, שעות עובדים וכספי פרויקטים.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}

