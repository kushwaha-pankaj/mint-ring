import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "mint-ring · Hockley Mint Studio",
    template: "%s · mint-ring",
  },
  description:
    "Identify, analyse, design, and try on Hockley Mint rings. BCU KTP demo studio.",
  applicationName: "mint-ring",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${interTight.variable}`}>
      <body className="min-h-full flex flex-col font-body bg-surface text-ink">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
