import { recognizedCount } from "./fields";

/** Uma aba da planilha já como texto: cabeçalho + linhas (número da linha original). */
export type SheetTable = {
  name: string;
  headers: string[];
  rows: { line: number; cells: string[] }[];
};

export const MAX_IMPORT_ROWS = 1000;

const pad = (value: number) => String(value).padStart(2, "0");

/** Valor de célula do Excel → texto. Datas viram dd/mm/aaaa (hh:mm se houver hora). */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // O leitor entrega a data "de parede" em UTC (sem fuso). O Excel guarda a hora como
    // fração do dia (14:30 pode vir 14:29:59.999): arredonda para o minuto.
    const moment = new Date(Math.round(value.getTime() / 60_000) * 60_000);
    const date = `${pad(moment.getUTCDate())}/${pad(moment.getUTCMonth() + 1)}/${moment.getUTCFullYear()}`;
    const hasTime = moment.getUTCHours() !== 0 || moment.getUTCMinutes() !== 0;
    return hasTime ? `${date} ${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}` : date;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Separador mais provável (";" do Excel brasileiro, "," ou tab de colar da planilha). */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", "\t", ","].map((delimiter) => [delimiter, firstLine.split(delimiter).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ";";
}

/** CSV/TSV com aspas (RFC 4180), BOM e quebra de linha dentro de aspas. */
export function parseDelimited(input: string, delimiter = detectDelimiter(input.replace(/^﻿/, ""))): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Matriz de células → tabela. O cabeçalho é a primeira linha (entre as 10
 * primeiras) com pelo menos 2 colunas reconhecidas; sem nenhuma, a primeira
 * linha não vazia. Linhas totalmente vazias são descartadas; colunas sem
 * cabeçalho e sem dados também.
 */
export function toTable(name: string, matrix: unknown[][]): SheetTable {
  const text = matrix.map((row) => row.map(cellToText));
  const nonEmpty = (row: string[]) => row.some((cell) => cell !== "");

  let headerIndex = text.slice(0, 10).findIndex((row) => recognizedCount(row) >= 2);
  if (headerIndex < 0) headerIndex = text.findIndex(nonEmpty);
  if (headerIndex < 0) return { name, headers: [], rows: [] };

  const body = text
    .map((cells, index) => ({ line: index + 1, cells }))
    .slice(headerIndex + 1)
    .filter((row) => nonEmpty(row.cells));

  const width = Math.max(text[headerIndex].length, ...body.map((row) => row.cells.length));
  const keep = Array.from({ length: width }, (_, column) => column).filter(
    (column) => (text[headerIndex][column] ?? "") !== "" || body.some((row) => (row.cells[column] ?? "") !== ""),
  );

  return {
    name,
    headers: keep.map((column) => text[headerIndex][column] ?? ""),
    rows: body.map((row) => ({ line: row.line, cells: keep.map((column) => row.cells[column] ?? "") })),
  };
}

/** Lê .xlsx (todas as abas), .csv/.tsv/.txt. Roda no navegador: o arquivo não sai do aparelho. */
export async function readSpreadsheetFile(file: File): Promise<SheetTable[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new Error("Arquivo .xls antigo: salve como .xlsx ou .csv e tente de novo.");
  }
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/universal");
    const sheets = await readXlsxFile(file);
    return sheets.map((sheet) => toTable(sheet.sheet, sheet.data as unknown[][]));
  }
  const text = await file.text();
  return [toTable(file.name.replace(/\.[^.]+$/, ""), parseDelimited(text))];
}

/** Texto colado de uma planilha (Google Planilhas/Excel copiam com tab). */
export function readPastedText(text: string): SheetTable[] {
  return [toTable("Dados colados", parseDelimited(text))];
}
