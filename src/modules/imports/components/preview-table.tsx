"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AVAILABILITY_OPTIONS, COURSE_OPTIONS, DOCUMENTATION_OPTIONS } from "@/modules/candidates/labels";

import { FIELD_LABEL, isRefField, type ImportField, type RefField } from "../fields";
import type { RefOptions, ResolvedRow } from "../resolve";

const PAGE_SIZE = 50;

type Filter = "all" | "problems" | "warnings";

const YES_NO = [
  { value: "Sim", label: "Sim" },
  { value: "Não", label: "Não" },
];

/** Campos de escolha: o valor editado é o rótulo, que as regras de importação reconhecem. */
const ENUM_OPTIONS: Partial<Record<ImportField, readonly { value: string; label: string }[]>> = {
  availability: AVAILABILITY_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
  currently_working: YES_NO,
  documentation: DOCUMENTATION_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
  course: COURSE_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
  cavaplay: YES_NO,
  course_paid_by_cava: YES_NO,
};

const WIDTH: Partial<Record<ImportField, string>> = {
  full_name: "min-w-52",
  phone: "min-w-40",
  email: "min-w-52",
  cpf: "min-w-36",
  notes: "min-w-64",
};

function enumValue(field: ImportField, resolved: ResolvedRow): string {
  const row = resolved.row;
  const yesNo = (value: boolean | null) => (value === null ? "" : value ? "Sim" : "Não");
  switch (field) {
    case "availability":
      return AVAILABILITY_OPTIONS.find((option) => option.value === row.availability)?.label ?? "";
    case "currently_working":
      return yesNo(row.currently_working);
    case "documentation":
      return DOCUMENTATION_OPTIONS.find((option) => option.value === row.documentation_status)?.label ?? "";
    case "course":
      return COURSE_OPTIONS.find((option) => option.value === row.course_status)?.label ?? "";
    case "cavaplay":
      return yesNo(row.cavaplay);
    case "course_paid_by_cava":
      return yesNo(row.course_paid_by_cava);
    default:
      return "";
  }
}

const cellInput =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

type RowProps = {
  resolved: ResolvedRow;
  fields: ImportField[];
  options: RefOptions;
  defaultStatusName: string;
  included: boolean;
  serverProblem: string | undefined;
  onEdit: (key: string, field: ImportField, value: string) => void;
  onToggle: (key: string, include: boolean) => void;
};

const PreviewRow = memo(function PreviewRow({
  resolved,
  fields,
  options,
  defaultStatusName,
  included,
  serverProblem,
  onEdit,
  onToggle,
}: RowProps) {
  const errors = serverProblem ? [...resolved.errors, serverProblem] : resolved.errors;
  const blocked = errors.length > 0;
  const name = resolved.row.full_name || `linha ${resolved.line}`;

  function editor(field: ImportField) {
    const label = `${FIELD_LABEL[field]} da linha ${resolved.line}`;
    if (isRefField(field)) {
      const ref = resolved.refs[field as RefField];
      const value = ref.id ?? (ref.newName ? "__new__" : "");
      const list = options[field as RefField].filter((option) => option.is_active || option.id === ref.id);
      return (
        <select
          aria-label={label}
          className={cellInput}
          value={value}
          onChange={(event) => {
            const option = list.find((item) => item.id === event.target.value);
            onEdit(resolved.key, field, option ? option.name : "");
          }}
        >
          <option value="">{field === "status" ? `Padrão (${defaultStatusName})` : "—"}</option>
          {ref.newName ? <option value="__new__">Novo: {ref.newName}</option> : null}
          {list.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      );
    }
    const choices = ENUM_OPTIONS[field];
    if (choices) {
      return (
        <select
          aria-label={label}
          className={cellInput}
          value={enumValue(field, resolved)}
          onChange={(event) => onEdit(resolved.key, field, event.target.value)}
        >
          <option value="">—</option>
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    if (field === "notes") {
      const notes = (resolved.row.notes ?? "").split("\n").slice(0, -1).join(" · ");
      return (
        <p className="line-clamp-2 text-xs text-muted-foreground" title={resolved.row.notes ?? ""}>
          {notes || "—"}
        </p>
      );
    }
    const isDate = field.endsWith("_date");
    return (
      <input
        aria-label={label}
        className={cellInput}
        value={resolved.values[field] ?? ""}
        placeholder={isDate ? "dd/mm/aaaa" : undefined}
        inputMode={field === "phone" || field === "cpf" ? "tel" : undefined}
        aria-invalid={
          field === "full_name" ? resolved.row.full_name.length < 2 : isDate && warningsMention(resolved, field) ? true : undefined
        }
        onChange={(event) => onEdit(resolved.key, field, event.target.value)}
      />
    );
  }

  return (
    <tr className={cn("border-b align-top", blocked && "bg-destructive/5", !included && !blocked && "opacity-60")}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          className="mt-2.5 size-4 accent-primary"
          checked={included && !blocked}
          disabled={blocked}
          aria-label={`Importar linha ${resolved.line} (${name})`}
          onChange={(event) => onToggle(resolved.key, event.target.checked)}
        />
      </td>
      <td className="px-2 py-2 pt-4 text-xs text-muted-foreground tabular-nums">{resolved.line}</td>
      {fields.map((field) => (
        <td key={field} className={cn("px-1.5 py-2", WIDTH[field] ?? "min-w-36")}>
          {editor(field)}
        </td>
      ))}
      <td className="min-w-64 px-3 py-2 text-xs">
        {blocked ? (
          <ul className="space-y-0.5 pt-1.5 text-destructive">
            {errors.map((message) => (
              <li key={message} className="flex gap-1.5">
                <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {message}
              </li>
            ))}
          </ul>
        ) : resolved.warnings.length > 0 ? (
          <p className="flex gap-1.5 pt-1.5 text-amber-700 dark:text-amber-400" title={resolved.warnings.join("\n")}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {resolved.warnings[0]}
              {resolved.warnings.length > 1 ? ` (+${resolved.warnings.length - 1})` : ""}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 pt-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Pronto
          </p>
        )}
      </td>
    </tr>
  );
});

function warningsMention(resolved: ResolvedRow, field: ImportField) {
  return resolved.warnings.some((warning) => warning.startsWith(`${FIELD_LABEL[field]} não é uma data`));
}

export function PreviewTable({
  rows,
  fields,
  options,
  defaultStatusName,
  excluded,
  serverProblems,
  onEdit,
  onToggle,
  onToggleMany,
}: {
  rows: ResolvedRow[];
  fields: ImportField[];
  options: RefOptions;
  defaultStatusName: string;
  excluded: ReadonlySet<string>;
  serverProblems: Record<string, string>;
  onEdit: (key: string, field: ImportField, value: string) => void;
  onToggle: (key: string, include: boolean) => void;
  onToggleMany: (keys: string[], include: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const problems = useMemo(
    () => rows.filter((row) => row.errors.length > 0 || serverProblems[String(row.line)]),
    [rows, serverProblems],
  );
  const warnings = useMemo(
    () => rows.filter((row) => row.errors.length === 0 && !serverProblems[String(row.line)] && row.warnings.length > 0),
    [rows, serverProblems],
  );
  const visible = filter === "problems" ? problems : filter === "warnings" ? warnings : rows;
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const selectable = pageRows.filter((row) => row.errors.length === 0 && !serverProblems[String(row.line)]);
  const allSelected = selectable.length > 0 && selectable.every((row) => !excluded.has(row.key));

  return (
    <section aria-labelledby="preview-title" className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 id="preview-title" className="text-sm font-medium">
            Prévia ({formatNumber(rows.length)} {rows.length === 1 ? "linha" : "linhas"})
          </h2>
          <p className="text-sm text-muted-foreground">
            Corrija direto nas células. Linhas com problema ficam de fora até serem corrigidas.
          </p>
        </div>
        <div className="lg:w-[28rem]">
          <Segmented<Filter>
            name="preview-filter"
            ariaLabel="Mostrar linhas"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(0);
            }}
            options={[
              { value: "all", label: `Todas (${rows.length})` },
              { value: "problems", label: `Problema (${problems.length})` },
              { value: "warnings", label: `Aviso (${warnings.length})` },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  aria-label="Importar todas as linhas desta página"
                  onChange={(event) => onToggleMany(selectable.map((row) => row.key), event.target.checked)}
                />
              </th>
              <th className="px-2 py-2">Linha</th>
              {fields.map((field) => (
                <th key={field} className="px-2 py-2 whitespace-nowrap">
                  {FIELD_LABEL[field]}
                </th>
              ))}
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <PreviewRow
                key={row.key}
                resolved={row}
                fields={fields}
                options={options}
                defaultStatusName={defaultStatusName}
                included={!excluded.has(row.key)}
                serverProblem={serverProblems[String(row.line)]}
                onEdit={onEdit}
                onToggle={onToggle}
              />
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma linha neste filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {current + 1} de {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Página anterior"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Próxima página"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
