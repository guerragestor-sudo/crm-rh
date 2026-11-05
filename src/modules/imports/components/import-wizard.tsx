"use client";

import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/shared/native-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import { checkImportContactsAction, importCandidatesAction } from "../actions";
import { guessMapping, REF_FIELDS, type ColumnTarget, type ImportField, type RefField } from "../fields";
import { MAX_IMPORT_ROWS, type SheetTable } from "../parse";
import {
  buildDrafts,
  collectUnknownValues,
  contactsOf,
  newRefsOf,
  resolveRows,
  type RefOptions,
  type RowEdits,
  type ValueChoice,
} from "../resolve";
import type { ExistingContacts } from "../schema";
import { ColumnMapping } from "./column-mapping";
import { FilePicker } from "./file-picker";
import { PreviewTable } from "./preview-table";
import { UndoImportButton } from "./undo-import-button";
import { ValueMapping } from "./value-mapping";

/** Colunas sempre visíveis na prévia (mesmo sem coluna na planilha: o padrão vale). */
const ALWAYS: ImportField[] = ["full_name", "phone", "status"];

const REF_LABEL: Record<RefField, [string, string]> = {
  status: ["status", "status"],
  manager: ["gerente", "gerentes"],
  region: ["região", "regiões"],
  source: ["origem", "origens"],
  segment: ["ramo", "ramos"],
};

function firstSheetWithRows(sheets: SheetTable[]) {
  return Math.max(
    0,
    sheets.findIndex((sheet) => sheet.rows.length > 0),
  );
}

export function ImportWizard({
  options,
  defaultStatusId,
  today,
  canCreate,
}: {
  options: RefOptions;
  defaultStatusId: string;
  today: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [sheets, setSheets] = useState<SheetTable[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnTarget[]>([]);
  const [edits, setEdits] = useState<RowEdits>({});
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [choices, setChoices] = useState<Record<string, ValueChoice>>({});
  const [defaults, setDefaults] = useState({ statusId: defaultStatusId, sourceId: "" });
  const [existing, setExisting] = useState<ExistingContacts>({ phones: {}, cpfs: {} });
  const [serverProblems, setServerProblems] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ importId: string; inserted: number; label: string } | null>(null);
  const [importing, startImport] = useTransition();
  const checked = useRef(new Set<string>());

  const table = sheets?.[sheetIndex] ?? null;
  const sourceLabel = table && sheets && sheets.length > 1 ? `${fileName}, aba ${table.name}` : fileName;

  const context = useMemo(
    () => ({ options, choices, defaults, existing, today, canCreate, sourceLabel }),
    [options, choices, defaults, existing, today, canCreate, sourceLabel],
  );
  const drafts = useMemo(() => (table ? buildDrafts(table, mapping, edits) : []), [table, mapping, edits]);
  const rows = useMemo(() => resolveRows(drafts, excluded, context), [drafts, excluded, context]);
  const unknown = useMemo(() => collectUnknownValues(drafts, options, canCreate), [drafts, options, canCreate]);

  const ready = rows.filter((row) => !excluded.has(row.key) && row.errors.length === 0 && !serverProblems[String(row.line)]);
  const blocked = rows.filter((row) => row.errors.length > 0 || serverProblems[String(row.line)]).length;
  const unchecked = rows.length - ready.length - blocked;
  const tooMany = (table?.rows.length ?? 0) > MAX_IMPORT_ROWS;
  const hasName = mapping.includes("full_name");
  const newRefs = useMemo(() => newRefsOf(ready), [ready]);
  const newRefSummary = REF_FIELDS.filter((field) => newRefs[field].length > 0).map(
    (field) => `${REF_LABEL[field][newRefs[field].length === 1 ? 0 : 1]} ${newRefs[field].join(", ")}`,
  );

  const fields = useMemo(() => {
    const mapped = mapping.filter((target): target is ImportField => target !== "note" && target !== "ignore");
    const ordered = [...ALWAYS, ...mapped.filter((field) => !ALWAYS.includes(field) && field !== "notes")];
    return [...new Set(ordered), "notes" as const];
  }, [mapping]);

  // Telefones e CPFs novos na prévia: confere no CRM (com pausa para não consultar a cada tecla).
  useEffect(() => {
    const { phones, cpfs } = contactsOf(rows);
    const pending = {
      phones: phones.filter((phone) => !checked.current.has(`p:${phone}`)),
      cpfs: cpfs.filter((cpf) => !checked.current.has(`c:${cpf}`)),
    };
    if (pending.phones.length === 0 && pending.cpfs.length === 0) return;
    const timer = setTimeout(async () => {
      const response = await checkImportContactsAction(pending);
      if (!response.ok) return;
      pending.phones.forEach((phone) => checked.current.add(`p:${phone}`));
      pending.cpfs.forEach((cpf) => checked.current.add(`c:${cpf}`));
      setExisting((current) => ({
        phones: { ...current.phones, ...response.data.phones },
        cpfs: { ...current.cpfs, ...response.data.cpfs },
      }));
    }, 400);
    return () => clearTimeout(timer);
  }, [rows]);

  function reset() {
    setSheets(null);
    setFileName("");
    setResult(null);
    resetSheet([]);
  }

  function resetSheet(headers: string[]) {
    setMapping(guessMapping(headers));
    setEdits({});
    setExcluded(new Set());
    setChoices({});
    setServerProblems({});
  }

  function loaded(next: SheetTable[], name: string) {
    const index = firstSheetWithRows(next);
    setSheets(next);
    setFileName(name);
    setSheetIndex(index);
    setResult(null);
    resetSheet(next[index].headers);
  }

  const onEdit = useCallback((key: string, field: ImportField, value: string) => {
    setEdits((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setServerProblems((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const onToggle = useCallback((key: string, include: boolean) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (include) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onToggleMany = useCallback((keys: string[], include: boolean) => {
    setExcluded((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (include) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }, []);

  function runImport() {
    startImport(async () => {
      const response = await importCandidatesAction({ fileName: sourceLabel, rows: ready.map((row) => row.row) });
      if (!response.ok) {
        if (response.error.details) setServerProblems(response.error.details);
        toast.error(response.error.message);
        return;
      }
      setResult({ ...response.data, label: sourceLabel });
      setSheets(null);
      router.refresh();
    });
  }

  if (result) {
    return (
      <section aria-live="polite" className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
          <div className="space-y-1">
            <h2 className="text-base font-semibold">
              {result.inserted === 1 ? "1 candidato importado" : `${formatNumber(result.inserted)} candidatos importados`}
            </h2>
            <p className="text-sm text-muted-foreground">
              De “{result.label}”. Eles já aparecem na lista, no Kanban e nos relatórios. Errou algo? Dá para desfazer por 7 dias.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-10">
            <Link href="/candidatos">Ver candidatos</Link>
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={reset}>
            <Upload aria-hidden />
            Importar outra planilha
          </Button>
          <UndoImportButton importId={result.importId} fileName={result.label} rowCount={result.inserted} onUndone={reset} />
        </div>
      </section>
    );
  }

  if (!sheets || !table) return <FilePicker onLoaded={loaded} />;

  const defaultStatusName = options.status.find((status) => status.id === defaults.statusId)?.name ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(table.rows.length)} {table.rows.length === 1 ? "linha" : "linhas"} com dados
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheets.length > 1 ? (
            <div className="w-48">
              <NativeSelect
                aria-label="Aba da planilha"
                value={sheetIndex}
                onChange={(event) => {
                  const index = Number(event.target.value);
                  setSheetIndex(index);
                  resetSheet(sheets[index].headers);
                }}
              >
                {sheets.map((sheet, index) => (
                  <option key={sheet.name + index} value={index}>
                    Aba {sheet.name} ({sheet.rows.length})
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <Button type="button" variant="outline" className="h-10" onClick={reset}>
            Trocar arquivo
          </Button>
        </div>
      </div>

      {tooMany ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Esta aba tem {formatNumber(table.rows.length)} linhas; o limite é {formatNumber(MAX_IMPORT_ROWS)} por importação. Divida a
          planilha em partes menores.
        </p>
      ) : null}

      <ColumnMapping table={table} mapping={mapping} onChange={setMapping} />

      <section aria-labelledby="defaults-title" className="space-y-3 rounded-xl border bg-card p-4">
        <h2 id="defaults-title" className="text-sm font-medium">
          Para as linhas sem informação
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="default-status" className="text-sm">
              Status
            </label>
            <NativeSelect
              id="default-status"
              value={defaults.statusId}
              onChange={(event) => setDefaults((current) => ({ ...current, statusId: event.target.value }))}
            >
              {options.status
                .filter((status) => status.is_active)
                .map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="default-source" className="text-sm">
              Origem
            </label>
            <NativeSelect
              id="default-source"
              value={defaults.sourceId}
              onChange={(event) => setDefaults((current) => ({ ...current, sourceId: event.target.value }))}
            >
              <option value="">Nenhuma</option>
              {options.source
                .filter((source) => source.is_active)
                .map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
        </div>
      </section>

      <ValueMapping
        unknown={unknown}
        choices={choices}
        options={options}
        canCreate={canCreate}
        defaultStatusName={defaultStatusName}
        onChange={(key, choice) => setChoices((current) => ({ ...current, [key]: choice }))}
      />

      <PreviewTable
        rows={rows}
        fields={fields}
        options={options}
        defaultStatusName={defaultStatusName}
        excluded={excluded}
        serverProblems={serverProblems}
        onEdit={onEdit}
        onToggle={onToggle}
        onToggleMany={onToggleMany}
      />

      <div className="sticky bottom-20 z-20 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        <p className="text-sm text-muted-foreground">
          {!hasName
            ? "Escolha a coluna do nome para continuar."
            : `${formatNumber(ready.length)} ${ready.length === 1 ? "pronta" : "prontas"} para importar` +
              (blocked > 0 ? ` · ${formatNumber(blocked)} com problema` : "") +
              (unchecked > 0 ? ` · ${formatNumber(unchecked)} desmarcadas` : "")}
        </p>
        <Button
          type="button"
          className="h-11"
          disabled={!hasName || tooMany || ready.length === 0 || importing}
          onClick={() => setConfirmOpen(true)}
        >
          {importing ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {ready.length === 1 ? "Importar 1 candidato" : `Importar ${formatNumber(ready.length)} candidatos`}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ready.length === 1 ? "Importar 1 candidato?" : `Importar ${formatNumber(ready.length)} candidatos?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Entram todos de uma vez, com o status de cada linha.
              {rows.length > ready.length
                ? ` ${formatNumber(rows.length - ready.length)} ${rows.length - ready.length === 1 ? "linha fica" : "linhas ficam"} de fora.`
                : ""}
              {newRefSummary.length > 0 ? ` Também serão criados: ${newRefSummary.join("; ")}.` : ""} Você pode desfazer por 7
              dias em “Importações recentes”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Revisar mais</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={runImport}>
              Importar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
