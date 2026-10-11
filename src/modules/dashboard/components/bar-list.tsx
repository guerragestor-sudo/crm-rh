import Link from "next/link";

import { formatNumber } from "@/lib/format";

import type { CountItem } from "../types";

/**
 * Distribuição de uma série (uma cor só): barras horizontais ordenadas, valor
 * escrito ao lado (identidade pelo rótulo, nunca só pela cor) e link para a
 * lista filtrada. A própria lista serve de tabela acessível.
 */
export function BarList({
  items,
  filterKey,
  emptyText = "Sem dados.",
  limit = 8,
}: {
  items: CountItem[];
  filterKey?: "source_ids" | "region_ids" | "manager_ids";
  emptyText?: string;
  limit?: number;
}) {
  if (items.length === 0 || items.every((item) => item.count === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  const sorted = [...items].sort((a, b) => b.count - a.count);
  const visible = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  if (rest.length > 0) {
    visible.push({ id: null, name: `Outros (${rest.length})`, count: rest.reduce((sum, item) => sum + item.count, 0) });
  }
  const max = Math.max(...visible.map((item) => item.count), 1);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  return (
    <ul className="space-y-1.5">
      {visible.map((item, index) => {
        const percent = Math.round((item.count / Math.max(total, 1)) * 100);
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatNumber(item.count)} <span className="text-xs">({percent}%)</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-[#2a78d6] transition-[filter] group-hover:brightness-110"
                style={{ width: `${(item.count / max) * 100}%`, minWidth: item.count > 0 ? 4 : 0 }}
              />
            </div>
          </>
        );
        const clickable = filterKey && item.id;
        return (
          <li key={item.id ?? `none-${index}`}>
            {clickable ? (
              <Link
                href={`/candidatos?${filterKey}=${item.id}`}
                className="group block rounded-md px-1.5 py-1 hover:bg-muted/60"
                title={`${item.name}: ${item.count} candidatos (${percent}%)`}
              >
                {content}
              </Link>
            ) : (
              <div className="group px-1.5 py-1" title={`${item.name}: ${item.count} candidatos (${percent}%)`}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
