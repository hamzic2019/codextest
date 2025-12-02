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
  title: "PflegeKI",
  description:
    "Brzi AI planer za Pflegedienst timove: pacijenti, radnici, smjene i PDF izvještaji.",
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
        {children}
      </body>
    </html>
  );
}
