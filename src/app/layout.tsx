import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BookMe",
  description: "More time coaching. Less time scheduling.",
  applicationName: "BookMe",
  manifest: "/manifest.webmanifest",
  themeColor: "#10B981",
  appleWebApp: {
    capable: true,
    title: "BookMe",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
