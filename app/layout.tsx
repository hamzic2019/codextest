import { PwaClient } from "@/components/pwa/pwa-client";
import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PflegeKI - Your Buddy",
  description:
    "Brzi AI planer za Pflegedienst timove: pacijenti, radnici, smjene i PDF izvještaji.",
  applicationName: "PflegeKI",
  manifest: "/manifest.webmanifest",
  themeColor: "#0ea5e9",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PflegeKI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bs" suppressHydrationWarning>
      <body
        className={`${display.variable} ${sans.variable} bg-surface text-slate-900 antialiased`}
        suppressHydrationWarning
      >
        <PwaClient />
        {children}
      </body>
    </html>
  );
}
