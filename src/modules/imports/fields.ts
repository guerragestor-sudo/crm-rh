import { fold } from "./sheet-rules.mjs";

/**
 * Campos do CRM que uma coluna da planilha pode preencher. Os nomes de coluna
 * reconhecidos (aliases, comparados sem acento/maiúsculas) cobrem a planilha
 * ESTEIRA (SETE.26…), a exportação CSV do próprio CRM e a lista do Indeed.
 */
export const IMPORT_FIELDS = [
  { key: "full_name", label: "Nome", aliases: ["nome candidato", "nome", "nome completo", "candidato", "name"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "celular", "whatsapp", "fone", "tel", "telefone/whatsapp", "contato"] },
  { key: "email", label: "E-mail", aliases: ["e-mail", "email"] },
  { key: "cpf", label: "CPF", aliases: ["cpf"] },
  { key: "status", label: "Status", aliases: ["status"] },
  { key: "manager", label: "Gerente", aliases: ["gerente indicacao", "gerente", "gerente de destino"] },
  { key: "region", label: "Região", aliases: ["regiao"] },
  { key: "source", label: "Origem", aliases: ["captacao midia", "origem", "captacao", "midia", "fonte"] },
  { key: "segment", label: "Ramo", aliases: ["ramo", "segmento"] },
  { key: "availability", label: "Disponibilidade", aliases: ["disponibilidade"] },
  { key: "currently_working", label: "Trabalha atualmente", aliases: ["trabalha", "trabalha atualmente"] },
  { key: "interview_date", label: "Data da entrevista", aliases: ["data entrevista", "entrevista", "data da entrevista"] },
  { key: "integration_planned_date", label: "Integração prevista", aliases: ["integracao prevista"] },
  { key: "integration_date", label: "Data de integração", aliases: ["data integracao", "integracao", "data de integracao"] },
  { key: "created_date", label: "Data de cadastro", aliases: ["cadastro", "data de cadastro", "data cadastro", "cadastrado em"] },
  {
    key: "documentation",
    label: "Cadastro/documentação",
    aliases: ["cadastro+doc", "cadastro + doc", "documentacao", "cadastro/documentacao"],
  },
  { key: "course", label: "Curso", aliases: ["cadastro curso", "curso"] },
  { key: "cavaplay", label: "Cavaplay", aliases: ["cavaplay 1.200", "cavaplay"] },
  { key: "course_paid_by_cava", label: "Curso pago pela Cava", aliases: ["curso pago pela cava"] },
  { key: "notes", label: "Observação", aliases: ["observacao", "observacoes", "obs", "notas", "anotacoes"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

/** "note" = anotar na observação como "Coluna: valor"; "ignore" = descartar. */
export type ColumnTarget = ImportField | "note" | "ignore";

export const REF_FIELDS = ["status", "manager", "region", "source", "segment"] as const;
export type RefField = (typeof REF_FIELDS)[number];

export const DATE_FIELDS = ["interview_date", "integration_date", "integration_planned_date", "created_date"] as const;

export function isRefField(field: string): field is RefField {
  return (REF_FIELDS as readonly string[]).includes(field);
}

export const FIELD_LABEL: Record<ImportField, string> = Object.fromEntries(
  IMPORT_FIELDS.map((field) => [field.key, field.label]),
) as Record<ImportField, string>;

/** Colunas que não carregam informação útil (o CRM calcula ou não guarda). */
const IGNORED_HEADERS = new Set(["", "#", "sla (dias)", "sla", "arquivo", "item", "n", "no", "nº"]);

const ALIAS_INDEX = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) => field.aliases.map((alias) => [alias, field.key] as const)),
);

/** Campo sugerido para um cabeçalho (sem sugestão: anotar na observação). */
export function guessTarget(header: string): ColumnTarget {
  const key = fold(header);
  if (IGNORED_HEADERS.has(key)) return "ignore";
  return ALIAS_INDEX.get(key) ?? "note";
}

/**
 * Sugestão para todas as colunas. Cada campo só pode vir de uma coluna (exceto
 * a observação): a segunda coluna com o mesmo campo vai para a observação.
 */
export function guessMapping(headers: string[]): ColumnTarget[] {
  const used = new Set<ColumnTarget>();
  return headers.map((header) => {
    const target = guessTarget(header);
    if (target === "note" || target === "ignore" || target === "notes") return target;
    if (used.has(target)) return "note";
    used.add(target);
    return target;
  });
}

/** Quantas colunas viraram campo do CRM (para achar a linha de cabeçalho). */
export function recognizedCount(headers: string[]): number {
  return headers.filter((header) => ALIAS_INDEX.has(fold(header))).length;
}

/** Cabeçalho do modelo para download (o mesmo da exportação CSV do CRM). */
export const TEMPLATE_HEADERS = [
  "Nome",
  "Telefone",
  "E-mail",
  "CPF",
  "Status",
  "Gerente",
  "Região",
  "Origem",
  "Ramo",
  "Disponibilidade",
  "Trabalha atualmente",
  "Entrevista",
  "Integração prevista",
  "Integração",
  "Documentação",
  "Curso",
  "Cavaplay",
  "Curso pago pela Cava",
  "Observação",
];
