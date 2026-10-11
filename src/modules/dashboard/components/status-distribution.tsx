import Link from "next/link";

import { statusBarClass, statusDotClass } from "@/lib/status-colors";

import type { StatusCountItem } from "../types";

export function StatusDistribution({ items }: { items: StatusCountItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {items.map((item) =>
          item.count > 0 ? (
            <div
              key={item.id}
              className={statusBarClass(item.color)}
              style={{ width: `${(item.count / Math.max(total, 1)) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/candidatos?status_ids=${item.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${statusDotClass(item.color)}`} aria-hidden />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
