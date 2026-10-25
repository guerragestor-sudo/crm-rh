"use client";

import { Loader2, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

import { ExportButton } from "@/modules/exports/export-button";

import { searchCandidatesAction } from "../actions";
import { countActiveFilters, filtersToSearchParams, type CandidateFilters } from "../filters";
import { rememberFilters } from "../saved-filters";
import { SORT_OPTIONS, type CandidateListResult, type CandidateOptions, type SortKey } from "../types";
import { CandidateCard } from "./candidate-card";
import { CandidateTable } from "./candidate-table";
import { ClearFiltersButton } from "./clear-filters-button";
import { FilterSheet, type FilterField } from "./filter-sheet";

const QUERY_STORAGE_KEY = "crm:candidates:q";

/**
 * Texto da busca guardado só na sessão do aparelho (sessionStorage), nunca na
 * URL. Memória como fonte principal: funciona mesmo sem storage (modo privado).
 */
let memoryQuery: string | null = null;
const queryListeners = new Set<() => void>();

function getQuerySnapshot(): string {
  if (memoryQuery === null) {
    try {
      memoryQuery = window.sessionStorage.getItem(QUERY_STORAGE_KEY) ?? "";
    } catch {
      memoryQuery = "";
    }
  }
  return memoryQuery;
}

function setStoredQuery(value: string) {
  memoryQuery = value;
  try {
    if (value.trim()) window.sessionStorage.setItem(QUERY_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(QUERY_STORAGE_KEY);
  } catch {
    // armazenamento indisponível: mantém só em memória
  }
  queryListeners.forEach((listener) => listener());
}

function subscribeQuery(listener: () => void) {
  queryListeners.add(listener);
  return () => {
    queryListeners.delete(listener);
  };
}

export function CandidateBrowser({
  initial,
  initialFilters,
  initialSort,
  options,
  today,
  nowTime,
  timezone,
  slaTarget,
  filterFields,
  canExport = false,
}: {
  initial: CandidateListResult;
  initialFilters: CandidateFilters;
  initialSort: SortKey;
  options: CandidateOptions;
  today: string;
  nowTime: string;
  timezone: string;
  slaTarget: number | null;
  filterFields: FilterField[];
  canExport?: boolean;
}) {
  const query = useSyncExternalStore(subscribeQuery, getQuerySnapshot, () => "");
  const setQuery = setStoredQuery;
  const [filters, setFilters] = useState<CandidateFilters>(initialFilters);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [result, setResult] = useState<CandidateListResult>(initial);
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const firstRun = useRef(true);

  // Mantém os filtros estruturados na URL (sem texto livre) sem recarregar a página
  // e salva no cookie da tela, para voltar da ficha do candidato com o filtro.
  useEffect(() => {
    const params = filtersToSearchParams(filters);
    if (sort !== "recent") params.set("sort", sort);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
    rememberFilters("candidatos", search);
  }, [filters, sort]);

  // Refaz a busca quando texto, filtros ou ordenação mudam (texto com debounce).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const current = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const response = await searchCandidatesAction({ filters: { ...filters, q: query }, sort, page: 1 });
        if (current !== requestId.current) return;
        if (response.ok) setResult(response.data);
        else toast.error(response.error.message);
      });
    }, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [query, filters, sort]);

  async function loadMore() {
    setLoadingMore(true);
    const response = await searchCandidatesAction({
      filters: { ...filters, q: query },
      sort,
      page: result.page + 1,
    });
    setLoadingMore(false);
    if (!response.ok) {
      toast.error(response.error.message);
      return;
    }
    setResult((current) => ({ ...response.data, rows: [...current.rows, ...response.data.rows] }));
  }

  const hasMore = result.rows.length < result.total;
  const activeCount = countActiveFilters(filters) + (query.trim() ? 1 : 0);
  const filtered = activeCount > 0;

  /** Volta à lista normal: sem busca, sem filtros e na ordem padrão. */
  function clearAll() {
    setQuery("");
    setFilters({});
    setSort("recent");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            inputMode="search"
            placeholder="Buscar por nome, telefone, e-mail ou CPF"
            aria-label="Buscar candidatos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 pl-9 text-base md:h-10 md:text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <FilterSheet value={filters} onApply={setFilters} options={options} fields={filterFields} triggerClassName="flex-1 md:flex-none" />
          <div className="flex-1 md:w-56 md:flex-none">
            <NativeSelect aria-label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {canExport ? <ExportButton filters={{ ...filters, q: query }} total={result.total} /> : null}
        </div>
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {formatNumber(result.total)}{" "}
          {result.total === 1
            ? filtered
              ? "candidato encontrado"
              : "candidato"
            : filtered
              ? "candidatos encontrados"
              : "candidatos"}
        </span>
        <div className="flex items-center gap-3">
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Carregando" /> : null}
          <ClearFiltersButton count={activeCount} onClear={clearAll} />
        </div>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          aria-busy={pending}
          icon={Users}
          title={filtered ? "Nenhum candidato encontrado" : "Nenhum candidato cadastrado"}
          description={
            filtered
              ? "Ajuste a busca ou os filtros para ver outros resultados."
              : "Cadastre o primeiro candidato para começar."
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={clearAll}>
                Limpar busca e filtros
              </Button>
            ) : null
          }
        />
      ) : (
        <div aria-busy={pending} data-results className={pending ? "opacity-60 transition-opacity" : undefined}>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:hidden">
            {result.rows.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                today={today}
                nowTime={nowTime}
                slaTarget={slaTarget}
              />
            ))}
          </div>
          <div className="hidden lg:block">
            <CandidateTable
              rows={result.rows}
              today={today}
              nowTime={nowTime}
              slaTarget={slaTarget}
              timezone={timezone}
            />
          </div>
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" className="h-11 w-full md:w-auto" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Carregar mais ({formatNumber(result.total - result.rows.length)} restantes)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
