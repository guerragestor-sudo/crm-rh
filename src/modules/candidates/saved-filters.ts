/**
 * Filtros salvos por tela: ao abrir um candidato e voltar, a lista e o Kanban
 * continuam filtrados. Guardados num cookie por 12 horas (renovado a cada uso),
 * apagados pelo "Limpar filtros" e ao sair do app.
 *
 * Só ids, datas, flags e ordenação: o texto da busca (pode ter CPF/telefone)
 * nunca vai para o cookie.
 */
export const SAVED_FILTERS_COOKIE = {
  candidatos: "crm_filtros_candidatos",
  kanban: "crm_filtros_kanban",
} as const;

export type SavedFiltersView = keyof typeof SAVED_FILTERS_COOKIE;

export const SAVED_FILTERS_MAX_AGE = 12 * 60 * 60;

/** Grava o filtro da tela no navegador (ou apaga, quando vazio). */
export function rememberFilters(view: SavedFiltersView, search: string) {
  const name = SAVED_FILTERS_COOKIE[view];
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = search ? encodeURIComponent(search) : "";
  const maxAge = search ? SAVED_FILTERS_MAX_AGE : 0;
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}
