import type { Database } from "@/types/database";

type PublicTables = Database["public"]["Tables"];

/**
 * Payload de INSERT sem as colunas preenchidas pelo banco a partir da sessão
 * (organization_id e autoria). O cliente não tem privilégio de gravá-las.
 */
export type SessionInsert<T extends keyof PublicTables> = Omit<PublicTables[T]["Insert"], "organization_id">;

/** O tipo gerado exige organization_id; o trigger set_organization_from_session o preenche. */
export function sessionInsert<T extends keyof PublicTables>(payload: SessionInsert<T>): PublicTables[T]["Insert"] {
  return payload as PublicTables[T]["Insert"];
}
