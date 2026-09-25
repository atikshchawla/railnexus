import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RailNexus — Automatic Block Planning",
  description:
    "AI-Driven Automatic Block Planning and Digital Twin System for Indian Railways",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-font-scale="normal"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="h-full flex overflow-hidden">{children}</body>
    </html>
  );
}
