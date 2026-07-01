"use client";

import { useEffect, useState } from "react";

export interface DocSection { id: string; label: string; group?: string }

export function DocsNav({ sections }: { sections: DocSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav className="space-y-0.5 text-sm">
      {sections.map((s, i) => {
        const newGroup = s.group && s.group !== sections[i - 1]?.group;
        return (
          <div key={s.id}>
            {newGroup && <div className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{s.group}</div>}
            <a
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={`block border-l-2 px-3 py-1 transition ${active === s.id ? "border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:hover:text-white"}`}
            >
              {s.label}
            </a>
          </div>
        );
      })}
    </nav>
  );
}
