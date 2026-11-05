import "server-only";

import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { isValidCpf } from "@/lib/cpf";
import { normalizePhone } from "@/lib/phone";
import type { CurrentMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";
import { AppError, fromDatabaseError } from "@/server/errors";
import type { SupabaseServerClient } from "@/server/supabase/server";
import { sessionInsert } from "@/server/supabase/types";
import type { Json } from "@/types/database";

import { addDays, formatIsoDate } from "./resolve";
import {
  contactsCheckSchema,
  importPayloadSchema,
  type ExistingContacts,
  type ImportPayload,
  type ImportRow,
  type RefValue,
} from "./schema";
import { clean, fold } from "./sheet-rules.mjs";

/** Horário usado quando a planilha só tem o dia (entrevista e data de cadastro). */
const DEFAULT_TIME = "09:00";
const CHUNK = 150;

type LookupField = "manager" | "region" | "source" | "segment";
const LOOKUP_FIELDS: LookupField[] = ["manager", "region", "source", "segment"];
const LOOKUP_TABLE = { region: "regions", source: "sources", segment: "segments" } as const;
const MAX_NAME: Record<LookupField, number> = { manager: 120, region: 80, source: 80, segment: 80 };
const LOOKUP_LABEL: Record<LookupField, string> = { manager: "gerente", region: "região", source: "origem", segment: "ramo" };

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** Telefones/CPFs da planilha que já existem na organização (inclusive arquivados: o índice único vale para todos). */
export async function findExistingContacts(supabase: SupabaseServerClient, input: unknown): Promise<ExistingContacts> {
  const parsed = contactsCheckSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", "Contatos inválidos.");
  const result: ExistingContacts = { phones: {}, cpfs: {} };

  const lists: ["phone" | "cpf", string[]][] = [
    ["phone", [...new Set(parsed.data.phones)]],
    ["cpf", [...new Set(parsed.data.cpfs)]],
  ];
  for (const [column, values] of lists) {
    for (const part of chunks(values)) {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, full_name, phone, cpf, archived_at")
        .in(column, part);
      if (error) throw fromDatabaseError(error, { op: "import_contacts" });
      for (const candidate of data ?? []) {
        const key = column === "phone" ? candidate.phone : candidate.cpf;
        if (!key) continue;
        const target = column === "phone" ? result.phones : result.cpfs;
        target[key] = { id: candidate.id, name: candidate.full_name, archived: candidate.archived_at !== null };
      }
    }
  }
  return result;
}

function dayAt(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(new TZDate(year, month - 1, day, hour, minute, timeZone).getTime()).toISOString();
}

/** Revalida no servidor tudo o que a prévia já conferiu (o navegador não é confiável). */
function rowProblems(rows: ImportRow[], today: string): Record<string, string> {
  const problems: Record<string, string> = {};
  const oldest = addDays(today, -5 * 365);
  const seenPhone = new Map<string, number>();
  const seenCpf = new Map<string, number>();
  const add = (line: number, message: string) => {
    problems[String(line)] ??= message;
  };

  for (const row of rows) {
    if (row.phone && normalizePhone(row.phone) !== row.phone) add(row.line, "Telefone inválido.");
    if (row.cpf && !isValidCpf(row.cpf)) add(row.line, "CPF inválido.");
    const created = row.created_date ?? today;
    if (created > today) add(row.line, "Data de cadastro no futuro.");
    if (created < oldest) add(row.line, "Data de cadastro com mais de 5 anos.");
    if (row.integration_date && row.integration_date > today) add(row.line, "Integração no futuro: use Integração prevista.");
    if (row.integration_date && row.integration_date < created) {
      add(row.line, `Integração antes da data de cadastro (${formatIsoDate(created)}).`);
    }
    if (row.phone) {
      const first = seenPhone.get(row.phone);
      if (first) add(row.line, `Telefone repetido na planilha (linha ${first}).`);
      else seenPhone.set(row.phone, row.line);
    }
    if (row.cpf) {
      const first = seenCpf.get(row.cpf);
      if (first) add(row.line, `CPF repetido na planilha (linha ${first}).`);
      else seenCpf.set(row.cpf, row.line);
    }
  }
  return problems;
}

/** Cria (se ainda não existirem) os cadastros escolhidos como "Criar" na prévia. Só administrador. */
async function createMissingLookups(
  supabase: SupabaseServerClient,
  member: CurrentMember,
  rows: ImportRow[],
): Promise<Record<LookupField, Map<string, string>>> {
  const ids = Object.fromEntries(LOOKUP_FIELDS.map((field) => [field, new Map<string, string>()])) as Record<
    LookupField,
    Map<string, string>
  >;

  for (const field of LOOKUP_FIELDS) {
    const names = new Map<string, string>();
    for (const row of rows) {
      const value = row[field];
      if (value && "new" in value) {
        const name = clean(value.new);
        if (name && !names.has(fold(name))) names.set(fold(name), name);
      }
    }
    if (names.size === 0) continue;
    if (member.role !== "admin") {
      throw new AppError("FORBIDDEN", `Só o administrador cria ${LOOKUP_LABEL[field]} novo. Escolha um existente na prévia.`);
    }
    for (const name of names.values()) {
      if (name.length > MAX_NAME[field]) {
        throw new AppError("VALIDATION", `Nome de ${LOOKUP_LABEL[field]} com mais de ${MAX_NAME[field]} caracteres: ${name}`);
      }
    }

    const known = ids[field];
    if (field === "manager") {
      const { data, error } = await supabase.from("managers").select("id, name");
      if (error) throw fromDatabaseError(error, { op: "import_lookup" });
      for (const item of data ?? []) known.set(fold(item.name), item.id);
      const missing = [...names.entries()].filter(([key]) => !known.has(key)).map(([, name]) => name);
      if (missing.length) {
        const { data: created, error: insertError } = await supabase
          .from("managers")
          .insert(missing.map((name) => sessionInsert<"managers">({ name })))
          .select("id, name");
        if (insertError) throw fromDatabaseError(insertError, { op: "import_create_manager" });
        for (const item of created ?? []) known.set(fold(item.name), item.id);
      }
    } else {
      const table = LOOKUP_TABLE[field];
      const { data, error } = await supabase.from(table).select("id, name, sort_order");
      if (error) throw fromDatabaseError(error, { op: "import_lookup" });
      for (const item of data ?? []) known.set(fold(item.name), item.id);
      const missing = [...names.entries()].filter(([key]) => !known.has(key)).map(([, name]) => name);
      if (missing.length) {
        const base = Math.max(-1, ...(data ?? []).map((item) => item.sort_order));
        const { data: created, error: insertError } = await supabase
          .from(table)
          .insert(missing.map((name, index) => sessionInsert<typeof table>({ name, sort_order: base + 1 + index })))
          .select("id, name");
        if (insertError) throw fromDatabaseError(insertError, { op: `import_create_${table}` });
        for (const item of created ?? []) known.set(fold(item.name), item.id);
      }
    }
  }
  return ids;
}

function refId(value: RefValue, created: Map<string, string>): string | null {
  if (!value) return null;
  if ("id" in value) return value.id;
  return created.get(fold(clean(value.new))) ?? null;
}

export async function importCandidates(
  supabase: SupabaseServerClient,
  member: CurrentMember,
  input: unknown,
): Promise<{ importId: string; inserted: number }> {
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = typeof issue?.path[1] === "number" ? issue.path[1] : null;
    const line = index !== null && Array.isArray((input as ImportPayload)?.rows) ? (input as ImportPayload).rows[index]?.line : null;
    throw new AppError(
      "VALIDATION",
      line ? `Linha ${line} com dado inválido (${String(issue.path.at(-1))}).` : "Dados da importação inválidos.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }
  const payload = parsed.data;
  const { today, timezone } = await getAppContext();

  const problems = rowProblems(payload.rows, today);
  const existing = await findExistingContacts(supabase, {
    phones: payload.rows.flatMap((row) => (row.phone ? [row.phone] : [])),
    cpfs: payload.rows.flatMap((row) => (row.cpf ? [row.cpf] : [])),
  });
  for (const row of payload.rows) {
    const match = (row.phone && existing.phones[row.phone]) || (row.cpf && existing.cpfs[row.cpf]);
    if (match) problems[String(row.line)] ??= `Já cadastrado no CRM: ${match.name}.`;
  }
  const problemCount = Object.keys(problems).length;
  if (problemCount > 0) {
    throw new AppError(
      "VALIDATION",
      problemCount === 1 ? "1 linha com problema. Corrija na prévia." : `${problemCount} linhas com problema. Corrija na prévia.`,
      undefined,
      problems,
    );
  }

  const lookups = await createMissingLookups(supabase, member, payload.rows);

  const rows = payload.rows.map((row) => ({
    full_name: clean(row.full_name),
    phone: row.phone,
    email: row.email,
    cpf: row.cpf,
    status_id: row.status_id,
    manager_id: refId(row.manager, lookups.manager),
    region_id: refId(row.region, lookups.region),
    source_id: refId(row.source, lookups.source),
    segment_id: refId(row.segment, lookups.segment),
    availability: row.availability,
    currently_working: row.currently_working,
    notes: row.notes,
    interview_at: row.interview_date ? dayAt(row.interview_date, row.interview_time ?? DEFAULT_TIME, timezone) : null,
    integration_date: row.integration_date,
    integration_planned_date: row.integration_date ? null : row.integration_planned_date,
    documentation_status: row.documentation_status,
    documentation_notes: row.documentation_notes,
    course_status: row.course_status,
    course_notes: row.course_notes,
    cavaplay: row.cavaplay,
    course_paid_by_cava: row.course_paid_by_cava,
    // Hoje (ou sem data): o banco usa o momento da gravação.
    created_at: row.created_date && row.created_date < today ? dayAt(row.created_date, DEFAULT_TIME, timezone) : null,
  }));

  const { data, error } = await supabase.rpc("import_candidates", {
    p_file_name: payload.fileName,
    p_rows: rows as unknown as Json,
  });
  if (error) {
    if (error.code === "23505") {
      throw new AppError("CONFLICT", "Um dos telefones ou CPFs acabou de ser cadastrado. Confira a prévia e tente de novo.");
    }
    throw fromDatabaseError(error, { op: "import_candidates" });
  }
  const result = data as { import_id: string; inserted: number };
  return { importId: result.import_id, inserted: result.inserted };
}

export async function undoImport(supabase: SupabaseServerClient, importId: unknown): Promise<number> {
  const parsed = z.uuid().safeParse(importId);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Importação não encontrada.");
  const { data, error } = await supabase.rpc("undo_candidate_import", { p_import_id: parsed.data });
  if (error) throw fromDatabaseError(error, { op: "undo_import" });
  return data as number;
}
