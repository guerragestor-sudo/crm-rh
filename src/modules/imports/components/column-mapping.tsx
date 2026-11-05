"use client";

import { ChevronDown } from "lucide-react";

import { NativeSelect } from "@/components/shared/native-select";

import { FIELD_LABEL, IMPORT_FIELDS, type ColumnTarget, type ImportField } from "../fields";
import type { SheetTable } from "../parse";

/** Coluna da planilha → campo do CRM. Vem preenchido pelo nome da coluna; ela só confere. */
export function ColumnMapping({
  table,
  mapping,
  onChange,
}: {
  table: SheetTable;
  mapping: ColumnTarget[];
  onChange: (mapping: ColumnTarget[]) => void;
}) {
  const fields = mapping.filter((target): target is ImportField => target !== "note" && target !== "ignore");
  const noted = table.headers.filter((_, column) => mapping[column] === "note");
  const ignored = table.headers.filter((_, column) => mapping[column] === "ignore");
  const missingName = !mapping.includes("full_name");

  function change(column: number, target: ColumnTarget) {
    const next = [...mapping];
    // Cada campo vem de uma coluna só (a observação pode juntar várias).
    if (target !== "note" && target !== "ignore" && target !== "notes") {
      next.forEach((current, index) => {
        if (current === target) next[index] = "note";
      });
    }
    next[column] = target;
    onChange(next);
  }

  return (
    <details open={missingName} className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Colunas da planilha</p>
          <p className="text-sm text-muted-foreground">
            {fields.length > 0 ? `Campos: ${[...new Set(fields)].map((field) => FIELD_LABEL[field]).join(", ")}.` : "Nenhuma coluna reconhecida."}
            {noted.length > 0 ? ` Vão para a observação: ${noted.map((header) => header || "sem nome").join(", ")}.` : ""}
            {ignored.length > 0 ? ` Ignoradas: ${ignored.map((header) => header || "sem nome").join(", ")}.` : ""}
          </p>
          {missingName ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Escolha qual coluna tem o nome do candidato.
            </p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm text-primary">
          Ajustar
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
        {table.headers.map((header, column) => {
          const sample = table.rows.find((row) => row.cells[column])?.cells[column] ?? "";
          const id = `column-${column}`;
          return (
            <div key={column} className="space-y-1.5">
              <label htmlFor={id} className="block truncate text-sm font-medium" title={header}>
                {header || `Coluna ${column + 1} (sem nome)`}
              </label>
              <NativeSelect id={id} value={mapping[column]} onChange={(event) => change(column, event.target.value as ColumnTarget)}>
                <option value="note">Anotar na observação</option>
                <option value="ignore">Ignorar</option>
                {IMPORT_FIELDS.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="truncate text-xs text-muted-foreground" title={sample}>
                {sample ? `Ex.: ${sample}` : "Coluna vazia"}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
