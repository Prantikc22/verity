import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CookieConsent } from "@/components/CookieConsent";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Verity — AI-augmented Playwright testing that heals itself",
    template: "%s · Verity",
  },
  description:
    "Verity generates Playwright tests from a sentence or URL, runs them in your CI, self-heals broken locators, and tells you what's a real regression vs. just flaky — in your pull requests. A QAShift product.",
  openGraph: { siteName: "Verity", type: "website", url: appUrl },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
