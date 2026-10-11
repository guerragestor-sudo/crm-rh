"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { filtersToSearchParams, type CandidateFilters } from "../filters";
import type { CandidateOptions } from "../types";
import { FilterSheet, type FilterField } from "./filter-sheet";

/** Filtros que vivem na URL (só ids e datas) e recarregam a página no servidor. */
export function UrlFilters({
  value,
  options,
  fields,
  preserve = [],
}: {
  value: CandidateFilters;
  options: CandidateOptions;
  fields: FilterField[];
  preserve?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: CandidateFilters) {
    const params = filtersToSearchParams(next);
    for (const key of preserve) {
      const current = searchParams.get(key);
      if (current) params.set(key, current);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return <FilterSheet value={value} onApply={apply} options={options} fields={fields} />;
}
