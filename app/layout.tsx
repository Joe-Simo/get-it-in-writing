import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/index.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://resilient-salamander-937.convex.site"),
  title: "Get It in Writing — Don’t rely on “probably.”",
  description:
    "Before you book, rent, buy, or hire, see what the official page actually promises and get consequential gaps confirmed in writing.",
  openGraph: {
    title: "Get It in Writing — Don’t rely on probably",
    description:
      "Turn official information and your real requirements into a private reliance map and scoped Proof Card.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2efe7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
