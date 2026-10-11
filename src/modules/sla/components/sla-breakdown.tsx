import { formatDays } from "@/lib/format";

import type { SlaBreakdownRow } from "../queries";

function monthLabel(key: string | null) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key ?? "—";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function SlaBreakdown({ rows, isMonth }: { rows: SlaBreakdownRow[]; isMonth: boolean }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sem dados para os filtros.</p>;
  }
  const maxAvg = Math.max(1, ...rows.map((row) => Number(row.avg ?? 0)));

  return (
    <>
      {/* Celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.key ?? "none"} className="rounded-xl border bg-card p-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium">{isMonth ? monthLabel(row.key) : row.name}</p>
              <span className="text-xs text-muted-foreground">{row.completed_count} integrados</span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Médio</dt>
                <dd className="font-medium tabular-nums">{formatDays(row.avg)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mediano</dt>
                <dd className="font-medium tabular-nums">{formatDays(row.median)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Menor–maior</dt>
                <dd className="font-medium tabular-nums">
                  {row.min === null ? "—" : `${row.min}–${row.max}`}
                </dd>
              </div>
            </dl>
            {!isMonth ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Aguardando: {row.waiting_count}
                {row.waiting_avg !== null ? ` · há ${formatDays(row.waiting_avg)} em média` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-xs md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{isMonth ? "Mês" : "Grupo"}</th>
              <th className="px-3 py-2.5 text-right font-medium">Integrados</th>
              <th className="px-3 py-2.5 font-medium">SLA médio</th>
              <th className="px-3 py-2.5 text-right font-medium">Mediano</th>
              <th className="px-3 py-2.5 text-right font-medium">Menor</th>
              <th className="px-3 py-2.5 text-right font-medium">Maior</th>
              {!isMonth ? (
                <>
                  <th className="px-3 py-2.5 text-right font-medium">Aguardando</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tempo médio aguardando</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key ?? "none"}>
                <td className="px-4 py-2.5 font-medium">{isMonth ? monthLabel(row.key) : row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.completed_count}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(row.avg ?? 0) / maxAvg) * 100}%` }} />
                    </div>
                    <span className="tabular-nums">{formatDays(row.avg)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatDays(row.median)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatDays(row.min)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatDays(row.max)}</td>
                {!isMonth ? (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.waiting_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatDays(row.waiting_avg)}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
