import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Navbar } from "@/components/landing/Navbar";
import { StartRunner } from "@/components/landing/StartRunner";

export const metadata: Metadata = { title: "Get your first test", robots: { index: false } };

export default async function StartPage({ searchParams }: { searchParams: Promise<{ input?: string }> }) {
  const { input } = await searchParams;
  const user = await getUser();
  if (!user) {
    // Force signup/login first, then come back here to generate + save.
    redirect(`/login?next=${encodeURIComponent(`/start?input=${encodeURIComponent(input ?? "")}`)}`);
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-6 py-20">
        <StartRunner input={input ?? ""} />
      </main>
    </div>
  );
}
