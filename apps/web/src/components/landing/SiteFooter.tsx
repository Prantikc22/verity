import Link from "next/link";
import { Logo } from "@/components/Logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      ["How it works", "/#how"],
      ["Test coverage", "/#coverage"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Documentation", "/docs"],
      ["MCP server", "/mcp"],
      ["GitHub App", "/github"],
    ],
  },
  {
    title: "Company",
    links: [
      ["QAShift", "https://www.qashifthq.com"],
      ["About", "https://www.qashifthq.com/about"],
      ["Contact", "https://www.qashifthq.com/contact"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 md:grid-cols-[1.35fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Verification you can run, inspect, and own. Verity turns live product behavior into maintained Playwright evidence.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All systems operational
          </div>
        </div>

        <div className="grid grid-cols-2 gap-9 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">{group.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("http") ? (
                      <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-indigo-600 dark:hover:text-indigo-300">{label}</a>
                    ) : (
                      <Link href={href} className="transition hover:text-indigo-600 dark:hover:text-indigo-300">{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Verity, a QAShift product.</span>
          <span>AI writes · the live product proves · your team owns</span>
        </div>
      </div>
    </footer>
  );
}
