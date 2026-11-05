"use client";

import { ClipboardPaste, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toCsv } from "@/modules/exports/csv";
import { cn } from "@/lib/utils";

import { TEMPLATE_HEADERS } from "../fields";
import { readPastedText, readSpreadsheetFile, type SheetTable } from "../parse";

/** Escolher arquivo (.xlsx/.csv), arrastar ou colar as linhas copiadas da planilha. */
export function FilePicker({ onLoaded }: { onLoaded: (sheets: SheetTable[], fileName: string) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const sheets = await readSpreadsheetFile(file);
      if (!sheets.some((sheet) => sheet.rows.length > 0)) throw new Error("A planilha está vazia.");
      onLoaded(sheets, file.name);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Não foi possível ler o arquivo.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function usePasted() {
    const sheets = readPastedText(pasted);
    if (!sheets[0].rows.length) {
      setError("Cole o cabeçalho e pelo menos uma linha.");
      return;
    }
    setError(null);
    onLoaded(sheets, "Dados colados");
  }

  function downloadTemplate() {
    const blob = new Blob([toCsv(TEMPLATE_HEADERS, [])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-importacao-candidatos.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void load(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background px-6 py-10 text-center transition-colors hover:bg-muted/50",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-5" aria-hidden />}
        </span>
        <span className="text-sm font-medium">{loading ? "Lendo a planilha…" : "Escolher planilha"}</span>
        <span className="max-w-md text-sm text-muted-foreground">
          Arquivo .xlsx (Excel ou Google Planilhas → Fazer download → .xlsx) ou .csv. A primeira linha com nomes de coluna é o
          cabeçalho.
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          aria-label="Arquivo da planilha"
          onChange={(event) => void load(event.target.files?.[0])}
          disabled={loading}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10" onClick={() => setPasteOpen((open) => !open)} aria-expanded={pasteOpen}>
          <ClipboardPaste aria-hidden />
          Colar da planilha
        </Button>
        <Button type="button" variant="ghost" className="h-10 text-muted-foreground" onClick={downloadTemplate}>
          <Download aria-hidden />
          Baixar modelo
        </Button>
      </div>

      {pasteOpen ? (
        <div className="space-y-2 rounded-xl border p-3">
          <label htmlFor={`${inputId}-paste`} className="text-sm font-medium">
            Selecione as células na planilha (com o cabeçalho), copie e cole aqui
          </label>
          <Textarea
            id={`${inputId}-paste`}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={6}
            className="font-mono text-xs"
            placeholder={"NOME CANDIDATO\tTELEFONE\tSTATUS\nAna Souza\t11 91111-2222\tSeletiva"}
          />
          <Button type="button" className="h-10" onClick={usePasted} disabled={!pasted.trim()}>
            Ver prévia
          </Button>
        </div>
      ) : null}
    </div>
  );
}
