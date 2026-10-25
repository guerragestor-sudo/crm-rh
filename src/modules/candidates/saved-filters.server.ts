import "server-only";

import { cookies } from "next/headers";

import { withSavedParams } from "./filters";
import { SAVED_FILTERS_COOKIE, type SavedFiltersView } from "./saved-filters";

/** Parâmetros da URL; sem filtro na URL, usa o filtro salvo da tela (se houver). */
export async function searchParamsWithSaved(
  view: SavedFiltersView,
  params: Record<string, string | string[] | undefined>,
) {
  const saved = (await cookies()).get(SAVED_FILTERS_COOKIE[view])?.value;
  return withSavedParams(params, saved);
}

/** Apaga os filtros salvos de todas as telas (usado ao sair do app). */
export async function forgetSavedFilters() {
  const store = await cookies();
  for (const name of Object.values(SAVED_FILTERS_COOKIE)) store.delete(name);
}
