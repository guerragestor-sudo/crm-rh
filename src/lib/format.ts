import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** 12 → "12 dias"; 1 → "1 dia"; 12.5 → "12,5 dias"; null → "—" */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${text} ${rounded === 1 ? "dia" : "dias"}`;
}

/** Data civil (yyyy-MM-dd) → "08/10/2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return format(parseISO(value), "dd/MM/yyyy");
}

/** Data civil → "qua, 08 out" */
export function formatShortDate(value: string): string {
  return format(parseISO(value), "EEE, dd MMM", { locale: ptBR });
}

/** Instante (timestamptz) → "08/10/2026 14:30" no fuso informado */
export function formatDateTime(value: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "";
  return format(new TZDate(value, timeZone), "dd/MM/yyyy HH:mm");
}

/** "14:30:00" → "14:30" */
export function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

/** Rótulo relativo para datas civis: Hoje, Amanhã, Ontem, ou a data. */
export function relativeDayLabel(value: string, today: string): string {
  const diff = differenceInCalendarDays(parseISO(value), parseISO(today));
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return formatShortDate(value);
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}
