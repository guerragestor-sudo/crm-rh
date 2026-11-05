import { formatDateTime, formatNumber } from "@/lib/format";

import type { RecentImport } from "../queries";
import { UndoImportButton } from "./undo-import-button";

/** Últimas importações, com "Desfazer" para quem importou (ou administrador) por 7 dias. */
export function RecentImports({
  imports,
  memberNames,
  currentMemberId,
  isAdmin,
  timezone,
}: {
  imports: RecentImport[];
  memberNames: Record<string, string>;
  currentMemberId: string;
  isAdmin: boolean;
  timezone: string;
}) {
  if (imports.length === 0) return null;

  return (
    <section aria-labelledby="recent-imports-title" className="space-y-3">
      <h2 id="recent-imports-title" className="text-sm font-medium">
        Importações recentes
      </h2>
      <ul className="divide-y rounded-xl border bg-card">
        {imports.map((item) => {
          const canUndo =
            !item.undone_at &&
            !item.expired &&
            (isAdmin || item.created_by_member_id === currentMemberId);
          return (
            <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(item.row_count)} {item.row_count === 1 ? "candidato" : "candidatos"} ·{" "}
                  {formatDateTime(item.created_at, timezone)} · {memberNames[item.created_by_member_id] ?? "Usuário"}
                  {item.undone_at ? ` · desfeita em ${formatDateTime(item.undone_at, timezone)}` : ""}
                </p>
              </div>
              {canUndo ? <UndoImportButton importId={item.id} fileName={item.file_name} rowCount={item.row_count} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
