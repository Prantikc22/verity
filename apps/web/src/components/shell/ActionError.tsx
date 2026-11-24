import Link from "next/link";

/** Error line for agent actions. Out-of-credit errors get a direct way to fix them. */
export function ActionError({ error, className = "mt-2" }: { error: string; className?: string }) {
  const credits = /credit/i.test(error) && /upgrade/i.test(error);
  return (
    <div role="alert" className={`${className} flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-red-600`}>
      <span>{error}</span>
      {credits && (
        <Link href="/dashboard/usage#plans" className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">Upgrade plan</Link>
      )}
    </div>
  );
}
