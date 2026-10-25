import { z } from "zod";

import type { Json } from "@/types/database";

/**
 * Filtros de candidatos — a mesma estrutura serve lista, Kanban, dashboard,
 * SLA e exportação (o banco aplica tudo em filter_candidates).
 *
 * Privacidade: o texto livre `q` (pode conter CPF/telefone) NUNCA vai para a
 * URL; só ids e datas são serializados em search params.
 */
const uuidList = z.array(z.uuid()).max(50).optional();
const isoDate = z.iso.date().optional();
const yesNo = z.enum(["yes", "no"]).optional();

export const candidateFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status_ids: uuidList,
  region_ids: uuidList,
  source_ids: uuidList,
  manager_ids: uuidList,
  segment_ids: uuidList,
  created_from: isoDate,
  created_to: isoDate,
  integration_from: isoDate,
  integration_to: isoDate,
  integration: z.enum(["done", "pending"]).optional(),
  no_next_action: z.boolean().optional(),
  has_overdue_task: z.boolean().optional(),
  missing_phone: z.boolean().optional(),
  cavaplay: yesNo,
  course_paid_by_cava: yesNo,
  archived: z.boolean().optional(),
});

export type CandidateFilters = z.infer<typeof candidateFiltersSchema>;

const LIST_KEYS = ["status_ids", "region_ids", "source_ids", "manager_ids", "segment_ids"] as const;
const DATE_KEYS = ["created_from", "created_to", "integration_from", "integration_to"] as const;
const FLAG_KEYS = ["no_next_action", "has_overdue_task", "missing_phone", "archived"] as const;
const ENUM_KEYS = ["integration", "cavaplay", "course_paid_by_cava"] as const;

type SearchParamsInput = Record<string, string | string[] | undefined> | URLSearchParams;

function readParam(params: SearchParamsInput, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Lê filtros estruturados da URL (ignora valores inválidos em vez de falhar). */
export function filtersFromSearchParams(params: SearchParamsInput): CandidateFilters {
  const raw: Record<string, unknown> = {};
  for (const key of LIST_KEYS) {
    const value = readParam(params, key);
    if (value) raw[key] = value.split(",").filter(Boolean);
  }
  for (const key of DATE_KEYS) {
    const value = readParam(params, key);
    if (value) raw[key] = value;
  }
  for (const key of FLAG_KEYS) {
    if (readParam(params, key) === "1") raw[key] = true;
  }
  for (const key of ENUM_KEYS) {
    const value = readParam(params, key);
    if (value) raw[key] = value;
  }

  const parsed = candidateFiltersSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // Mantém apenas os campos válidos.
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = candidateFiltersSchema.shape[key as keyof CandidateFilters];
    if (field && field.safeParse(value).success) clean[key] = value;
  }
  return candidateFiltersSchema.parse(clean);
}

/** Serializa filtros estruturados para a URL (sem o texto livre). */
export function filtersToSearchParams(filters: CandidateFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = filters[key];
    if (value?.length) params.set(key, value.join(","));
  }
  for (const key of DATE_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  for (const key of FLAG_KEYS) {
    if (filters[key]) params.set(key, "1");
  }
  for (const key of ENUM_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Chaves de filtro e ordenação que podem vir na URL. */
const PARAM_KEYS = [...LIST_KEYS, ...DATE_KEYS, ...FLAG_KEYS, ...ENUM_KEYS, "sort"] as const;

/** A URL já traz algum filtro ou ordenação? */
export function hasFilterParams(params: SearchParamsInput): boolean {
  return PARAM_KEYS.some((key) => Boolean(readParam(params, key)));
}

/**
 * Filtro salvo (cookie da tela) só vale quando a URL não traz filtro nenhum:
 * link com filtro explícito sempre vence. Valores inválidos são descartados
 * depois, em filtersFromSearchParams.
 */
export function withSavedParams(
  params: Record<string, string | string[] | undefined>,
  saved: string | undefined,
): Record<string, string | string[] | undefined> {
  if (!saved || hasFilterParams(params)) return params;
  let text = saved;
  try {
    if (text.includes("%")) text = decodeURIComponent(text);
  } catch {
    return params;
  }
  return { ...params, ...Object.fromEntries(new URLSearchParams(text)) };
}

/** Busca por telefone/CPF formatados: sem letras, compara só os dígitos. */
export function normalizeSearchText(q: string | undefined): string | undefined {
  const value = q?.trim();
  if (!value) return undefined;
  if (!/[a-zA-ZÀ-ÿ@]/.test(value)) {
    const digits = value.replace(/\D/g, "");
    return digits.length > 0 ? digits : undefined;
  }
  return value;
}

/** Converte para o formato aceito pela função SQL filter_candidates. */
export function toRpcFilters(filters: CandidateFilters): { [key: string]: Json } {
  const { q, ...rest } = filters;
  const normalized = normalizeSearchText(q);
  const result: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  if (normalized) result.q = normalized;
  return result;
}

export function countActiveFilters(filters: CandidateFilters): number {
  let count = 0;
  for (const key of LIST_KEYS) if (filters[key]?.length) count++;
  if (filters.created_from || filters.created_to) count++;
  if (filters.integration_from || filters.integration_to) count++;
  for (const key of ENUM_KEYS) if (filters[key]) count++;
  for (const key of FLAG_KEYS) if (filters[key]) count++;
  return count;
}
