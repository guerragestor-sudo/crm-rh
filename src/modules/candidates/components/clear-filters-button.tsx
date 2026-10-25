import { X } from "lucide-react";

/** Atalho discreto para voltar à lista normal; some quando não há filtro ativo. */
export function ClearFiltersButton({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <X className="size-3" aria-hidden />
      Limpar filtros ({count})
    </button>
  );
}
