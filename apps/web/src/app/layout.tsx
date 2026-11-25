import type { Metadata } from "next";
import { Inter, Geist_Mono, Instrument_Serif, Sora } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { NavProgress } from "@/components/shell/NavProgress";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CookieConsent } from "@/components/CookieConsent";

// Inter reads better than Geist at small UI sizes (bigger x-height, tuned for
// dense dashboards / sidebar scanning). Keeps the same CSS variable name.
const geistSans = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Brand wordmark, same as qashifthq.com.
const brand = Sora({ variable: "--font-brand", weight: ["600", "700"], subsets: ["latin"], display: "swap" });
const serif = Instrument_Serif({ variable: "--font-instrument", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "QAShift — AI test generation for Playwright, API & CI",
    template: "%s · QAShift",
  },
  description:
    "QAShift writes Playwright end-to-end and API tests from your live app, plus visual, AI-agent, load and security checks, and runs them in your own CI.",
  openGraph: {
    siteName: "QAShift",
    type: "website",
    url: appUrl,
    images: [{ url: `${appUrl}/og.png`, width: 1200, height: 630, alt: "QAShift — AI writes the tests. Your CI keeps the proof." }],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${appUrl}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} ${brand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}><NavProgress /></Suspense>
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
