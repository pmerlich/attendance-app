import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מנהל עבודה | פרויקטים, שעות וכספים",
  description: "מערכת לניהול עבודות שטח, שעות עובדים וכספי פרויקטים.",
  icons: { icon: "/app-icon.png", apple: "/app-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
