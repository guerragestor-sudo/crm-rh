import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { normalizePhone } from "@/lib/phone";

import { FIELD_LABEL, REF_FIELDS, type ColumnTarget, type ImportField, type RefField } from "./fields";
import type { SheetTable } from "./parse";
import { EMAIL_PATTERN, type ExistingContacts, type ImportRow, type RefValue } from "./schema";
import {
  clean,
  fold,
  isYes,
  mapAvailability,
  mapCourse,
  mapDocumentation,
  mapManager,
  mapRegion,
  mapSegment,
  mapSource,
  mapStatus,
  mapWorking,
} from "./sheet-rules.mjs";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type RefItem = { id: string; name: string; is_active: boolean };
export type RefOptions = Record<RefField, RefItem[]>;

/** O que fazer com um nome da planilha que não existe no CRM. */
export type ValueChoice =
  | { kind: "existing"; id: string }
  | { kind: "create"; name: string }
  | { kind: "blank" }
  | { kind: "default" };

export type UnknownValue = { field: RefField; raw: string; key: string; count: number; suggestion: ValueChoice };

/** Linha da prévia: valores por campo (texto da planilha ou editado na prévia). */
export type DraftRow = {
  key: string;
  line: number;
  values: Partial<Record<ImportField, string>>;
  extraNotes: string[];
};

export type RowEdits = Record<string, Partial<Record<ImportField, string>>>;

export type ResolveContext = {
  options: RefOptions;
  choices: Record<string, ValueChoice>;
  defaults: { statusId: string; sourceId: string };
  existing: ExistingContacts;
  today: string;
  canCreate: boolean;
  /** Ex.: "esteira.xlsx, aba OUT.26" (vai na observação de cada candidato). */
  sourceLabel: string;
};

export type ResolvedRef = { id: string | null; newName: string | null; name: string };

export type ResolvedRow = {
  key: string;
  line: number;
  values: Partial<Record<ImportField, string>>;
  refs: Record<RefField, ResolvedRef>;
  row: ImportRow;
  errors: string[];
  warnings: string[];
};

// -----------------------------------------------------------------------------
// Colunas → linhas da prévia
// -----------------------------------------------------------------------------

export function buildDrafts(table: SheetTable, mapping: ColumnTarget[], edits: RowEdits): DraftRow[] {
  return table.rows.map((source) => {
    const key = String(source.line);
    const values: Partial<Record<ImportField, string>> = {};
    const extraNotes: string[] = [];
    mapping.forEach((target, column) => {
      const cell = clean(source.cells[column] ?? "");
      if (!cell || target === "ignore") return;
      if (target === "note") {
        extraNotes.push(`${table.headers[column] || `Coluna ${column + 1}`}: ${cell}`);
      } else if (target === "notes") {
        values.notes = values.notes ? `${values.notes}\n${cell}` : cell;
      } else {
        values[target] = cell;
      }
    });
    return { key, line: source.line, values: { ...values, ...edits[key] }, extraNotes };
  });
}

// -----------------------------------------------------------------------------
// Cadastros de apoio (status, gerente, região, origem, ramo)
// -----------------------------------------------------------------------------

export const choiceKey = (field: RefField, raw: string) => `${field}:${fold(raw)}`;

/** Status só casa com status ativos; os demais cadastros, com qualquer um (inativo continua válido). */
export function findByName(field: RefField, name: string, options: RefOptions): RefItem | undefined {
  const target = fold(name);
  return options[field].find((item) => fold(item.name) === target && (field !== "status" || item.is_active));
}

/** Distância de edição (letras trocadas, faltando ou sobrando). */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Cadastro com nome quase igual (erro de digitação: "Ricrdo Souza" → Ricardo Souza). */
function closestByName(field: RefField, name: string, options: RefOptions): RefItem | undefined {
  const target = fold(name);
  const limit = target.length <= 4 ? 0 : target.length <= 8 ? 1 : 2;
  let best: RefItem | undefined;
  let bestDistance = limit + 1;
  for (const item of options[field]) {
    if (field === "status" && !item.is_active) continue;
    const distance = editDistance(target, fold(item.name));
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

/** Sugestão para um nome desconhecido: regras da planilha ESTEIRA (ex.: "Lendro" → Leandro) e erros de digitação. */
export function suggestChoice(field: RefField, raw: string, options: RefOptions, canCreate: boolean): ValueChoice {
  const suggested: string | null = (() => {
    switch (field) {
      case "status":
        return mapStatus(raw).name;
      case "manager":
        return mapManager(raw).name;
      case "region":
        return mapRegion(raw).name;
      case "source":
        return mapSource(raw).name;
      case "segment":
        return mapSegment(raw).name;
    }
  })();
  const existing =
    (suggested ? findByName(field, suggested, options) : undefined) ??
    closestByName(field, suggested ?? raw, options) ??
    closestByName(field, raw, options);
  if (existing) return { kind: "existing", id: existing.id };
  if (field === "status") return { kind: "default" };
  if (suggested && canCreate) return { kind: "create", name: suggested };
  return { kind: "blank" };
}

/** Nomes da planilha que não existem no CRM (uma vez cada, com quantas linhas usam). */
export function collectUnknownValues(drafts: DraftRow[], options: RefOptions, canCreate: boolean): UnknownValue[] {
  const found = new Map<string, UnknownValue>();
  for (const draft of drafts) {
    for (const field of REF_FIELDS) {
      const raw = clean(draft.values[field] ?? "");
      if (!raw || findByName(field, raw, options)) continue;
      const key = choiceKey(field, raw);
      const current = found.get(key);
      if (current) current.count += 1;
      else found.set(key, { field, raw, key, count: 1, suggestion: suggestChoice(field, raw, options, canCreate) });
    }
  }
  return [...found.values()].sort(
    (a, b) => REF_FIELDS.indexOf(a.field) - REF_FIELDS.indexOf(b.field) || b.count - a.count || a.raw.localeCompare(b.raw),
  );
}

function resolveRef(field: RefField, rawValue: string | undefined, context: ResolveContext): ResolvedRef & { note: string | null } {
  const raw = clean(rawValue ?? "");
  const byId = (id: string) => Object.values(context.options[field]).find((item) => item.id === id);
  const fromId = (id: string | undefined) => {
    const item = id ? byId(id) : undefined;
    return item ? { id: item.id, newName: null, name: item.name } : { id: null, newName: null, name: "" };
  };
  const defaultFor = () =>
    field === "status" ? fromId(context.defaults.statusId) : field === "source" ? fromId(context.defaults.sourceId) : fromId(undefined);

  if (!raw) return { ...defaultFor(), note: null };
  const exact = findByName(field, raw, context.options);
  if (exact) return { id: exact.id, newName: null, name: exact.name, note: null };

  const choice = context.choices[choiceKey(field, raw)] ?? suggestChoice(field, raw, context.options, context.canCreate);
  const note = `${FIELD_LABEL[field]} na planilha: ${raw}`;
  if (choice.kind === "existing") {
    const resolved = fromId(choice.id);
    return { ...resolved, note: fold(resolved.name) === fold(raw) ? null : note };
  }
  if (choice.kind === "create" && context.canCreate && field !== "status") {
    const name = clean(choice.name) || raw;
    return { id: null, newName: name, name, note: fold(name) === fold(raw) ? null : note };
  }
  return { ...defaultFor(), note };
}

const toRefValue = (ref: ResolvedRef): RefValue => (ref.id ? { id: ref.id } : ref.newName ? { new: ref.newName } : null);

// -----------------------------------------------------------------------------
// Datas
// -----------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

function isoFrom(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * "30/09", "30/09/2026", "30/09/26", "2026-09-30", com hora opcional ("14:30").
 * Sem ano: o ano que deixa a data mais perto de hoje (planilha do ciclo atual).
 */
export function parseDateText(value: string, today: string): { date: string; time: string | null } | null {
  const text = clean(value).toLowerCase();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ](\d{1,2}):(\d{2}))?/.exec(text);
  const br = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?:,?\s+(?:às\s+)?(\d{1,2})[:h](\d{2}))?$/.exec(text);
  let date: string | null = null;
  let hour: string | undefined;
  let minute: string | undefined;

  if (iso) {
    date = isoFrom(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    [hour, minute] = [iso[4], iso[5]];
  } else if (br) {
    const [day, month] = [Number(br[1]), Number(br[2])];
    [hour, minute] = [br[4], br[5]];
    if (br[3]) {
      date = isoFrom(br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]), month, day);
    } else {
      const year = Number(today.slice(0, 4));
      const candidates = [year - 1, year, year + 1]
        .map((option) => isoFrom(option, month, day))
        .filter((option): option is string => option !== null);
      candidates.sort((a, b) => Math.abs(daysBetween(a, today)) - Math.abs(daysBetween(b, today)));
      date = candidates[0] ?? null;
    }
  }
  if (!date) return null;
  const time = hour !== undefined && Number(hour) < 24 && Number(minute) < 60 ? `${pad(Number(hour))}:${minute}` : null;
  return { date, time };
}

export function formatIsoDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

// -----------------------------------------------------------------------------
// Linha da prévia → candidato
// -----------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function resolveRows(drafts: DraftRow[], excluded: ReadonlySet<string>, context: ResolveContext): ResolvedRow[] {
  const rows = drafts.map((draft) => resolveRow(draft, context));
  markDuplicates(
    rows.filter((row) => !excluded.has(row.key)),
    context.existing,
  );
  return rows;
}

function resolveRow(draft: DraftRow, context: ResolveContext): ResolvedRow {
  const { values, line } = draft;
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const text = (field: ImportField) => clean(values[field] ?? "");

  // Nome
  const fullName = text("full_name");
  if (fullName.length < 2) errors.push("Nome vazio ou muito curto.");
  else if (fullName.length > 150) errors.push("Nome com mais de 150 caracteres.");

  // Contato (inválido não impede: vai para a observação)
  const rawPhone = text("phone");
  const phone = normalizePhone(rawPhone);
  if (!rawPhone) warnings.push("Sem telefone: fica como telefone pendente.");
  else if (!phone) {
    warnings.push(`Telefone inválido (“${rawPhone}”): fica como telefone pendente e o número vai para a observação.`);
    notes.push(`Telefone na planilha (inválido): ${rawPhone}`);
  }

  const rawEmail = text("email").toLowerCase();
  const email = rawEmail && EMAIL_PATTERN.test(rawEmail) && rawEmail.length <= 200 ? rawEmail : null;
  if (rawEmail && !email) {
    warnings.push(`E-mail inválido (“${rawEmail}”): vai para a observação.`);
    notes.push(`E-mail na planilha (inválido): ${rawEmail}`);
  }

  const rawCpf = text("cpf");
  let cpfDigits = onlyDigits(rawCpf);
  if (cpfDigits.length >= 9 && cpfDigits.length < 11) cpfDigits = cpfDigits.padStart(11, "0"); // Excel tira o zero à esquerda
  const cpf = rawCpf && isValidCpf(cpfDigits) ? cpfDigits : null;
  if (rawCpf && !cpf) {
    warnings.push(`CPF inválido (“${rawCpf}”): vai para a observação.`);
    notes.push(`CPF na planilha (inválido): ${rawCpf}`);
  }

  // Cadastros de apoio
  const refs = {} as Record<RefField, ResolvedRef>;
  for (const field of REF_FIELDS) {
    const { note, ...ref } = resolveRef(field, values[field], context);
    refs[field] = ref;
    if (note) notes.push(note);
  }
  if (!refs.status.id) errors.push("Sem status: escolha o status padrão.");

  // Perfil
  const availability = mapAvailability(values.availability);
  if (availability.original) notes.push(`Disponibilidade na planilha: ${availability.original}`);
  const working = mapWorking(values.currently_working);
  if (working.original) notes.push(`Trabalha: ${working.original}`);

  // Datas
  const parseField = (field: ImportField) => {
    const raw = text(field);
    if (!raw) return null;
    const parsed = parseDateText(raw, context.today);
    if (!parsed) {
      warnings.push(`${FIELD_LABEL[field]} não é uma data (“${raw}”): vai para a observação.`);
      notes.push(`${FIELD_LABEL[field]} na planilha: ${raw}`);
    }
    return parsed;
  };
  const interview = parseField("interview_date");
  let integration = parseField("integration_date");
  let planned = parseField("integration_planned_date");
  const created = parseField("created_date");

  if (integration && integration.date > context.today) {
    warnings.push(`Integração futura (${formatIsoDate(integration.date)}): vai como Integração prevista.`);
    planned = planned ?? integration;
    integration = null;
  }

  // Data de cadastro (início do SLA): informada; senão a entrevista; senão a integração; senão hoje.
  let createdDate = created?.date ?? null;
  if (createdDate && createdDate > context.today) {
    errors.push(`Data de cadastro no futuro (${formatIsoDate(createdDate)}).`);
    createdDate = null;
  }
  if (!createdDate && interview && interview.date <= context.today) createdDate = interview.date;
  if (!createdDate && integration) createdDate = integration.date;
  if (createdDate && createdDate < addDays(context.today, -5 * 365)) {
    errors.push(`Data de cadastro muito antiga (${formatIsoDate(createdDate)}): o limite é de 5 anos.`);
  }
  if (integration && createdDate && integration.date < createdDate) {
    errors.push(
      `Integração (${formatIsoDate(integration.date)}) antes da entrevista/cadastro (${formatIsoDate(createdDate)}).`,
    );
  }

  // Cadastro e curso
  const documentation = mapDocumentation(values.documentation);
  const course = mapCourse(values.course);

  // Observação: texto da planilha + o que não coube nos campos + origem da importação.
  const allNotes = [
    text("notes") ? (values.notes ?? "").trim() : "",
    ...draft.extraNotes,
    ...notes,
    `Importado da planilha ${context.sourceLabel} (linha ${line}) em ${formatIsoDate(context.today)}.`,
  ].filter(Boolean);
  let notesText = allNotes.join("\n");
  if (notesText.length > 5000) {
    warnings.push("Observação com mais de 5.000 caracteres: foi cortada.");
    notesText = truncate(notesText, 5000);
  }

  return {
    key: draft.key,
    line,
    values,
    refs,
    errors,
    warnings,
    row: {
      line,
      full_name: fullName,
      phone,
      email,
      cpf,
      status_id: refs.status.id ?? "",
      manager: toRefValue(refs.manager),
      region: toRefValue(refs.region),
      source: toRefValue(refs.source),
      segment: toRefValue(refs.segment),
      availability: availability.value as ImportRow["availability"],
      currently_working: working.value,
      interview_date: interview?.date ?? null,
      interview_time: interview?.time ?? null,
      integration_date: integration?.date ?? null,
      integration_planned_date: planned?.date ?? null,
      created_date: createdDate,
      documentation_status: documentation.status as ImportRow["documentation_status"],
      documentation_notes: documentation.notes ? truncate(documentation.notes, 2000) : null,
      course_status: course.status as ImportRow["course_status"],
      course_notes: course.notes ? truncate(course.notes, 2000) : null,
      cavaplay: isYes(values.cavaplay),
      course_paid_by_cava: isYes(values.course_paid_by_cava),
      notes: notesText || null,
    },
  };
}

/** Telefone/CPF repetidos na planilha (a 1ª linha fica) ou já cadastrados no CRM. */
function markDuplicates(rows: ResolvedRow[], existing: ExistingContacts) {
  const seen = { phone: new Map<string, ResolvedRow>(), cpf: new Map<string, ResolvedRow>() };
  for (const row of rows) {
    for (const kind of ["phone", "cpf"] as const) {
      const value = row.row[kind];
      if (!value) continue;
      const label = kind === "phone" ? "Telefone" : "CPF";
      const match = (kind === "phone" ? existing.phones : existing.cpfs)[value];
      if (match) {
        row.errors.push(`${label} já cadastrado no CRM: ${match.name}${match.archived ? " (arquivado)" : ""}.`);
        continue;
      }
      const first = seen[kind].get(value);
      if (first) row.errors.push(`${label} repetido na planilha (linha ${first.line}, ${first.row.full_name}).`);
      else seen[kind].set(value, row);
    }
  }
}

/** Telefones e CPFs válidos da prévia (para conferir no CRM). */
export function contactsOf(rows: ResolvedRow[]): { phones: string[]; cpfs: string[] } {
  const phones = new Set<string>();
  const cpfs = new Set<string>();
  for (const { row } of rows) {
    if (row.phone) phones.add(row.phone);
    if (row.cpf) cpfs.add(row.cpf);
  }
  return { phones: [...phones], cpfs: [...cpfs] };
}

/** Cadastros que a importação vai criar (para mostrar antes de gravar). */
export function newRefsOf(rows: ResolvedRow[]): Record<RefField, string[]> {
  const result = Object.fromEntries(REF_FIELDS.map((field) => [field, [] as string[]])) as unknown as Record<RefField, string[]>;
  for (const row of rows) {
    for (const field of REF_FIELDS) {
      const name = row.refs[field].newName;
      if (name && !result[field].some((existing) => fold(existing) === fold(name))) result[field].push(name);
    }
  }
  return result;
}
