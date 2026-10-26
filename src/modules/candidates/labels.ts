export const AVAILABILITY_OPTIONS = [
  { value: "immediate", label: "Imediata" },
  { value: "up_to_15_days", label: "Até 15 dias" },
  { value: "up_to_30_days", label: "Até 30 dias" },
  { value: "to_negotiate", label: "A combinar" },
] as const;

export const DOCUMENTATION_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "complete", label: "Completa" },
] as const;

export const COURSE_OPTIONS = [
  { value: "not_started", label: "Não iniciado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluído" },
] as const;

export type Availability = (typeof AVAILABILITY_OPTIONS)[number]["value"];
export type DocumentationStatus = (typeof DOCUMENTATION_OPTIONS)[number]["value"];
export type CourseStatus = (typeof COURSE_OPTIONS)[number]["value"];

function toMap<T extends readonly { value: string; label: string }[]>(options: T) {
  return Object.fromEntries(options.map((option) => [option.value, option.label])) as Record<string, string>;
}

export const AVAILABILITY_LABELS = toMap(AVAILABILITY_OPTIONS);
export const DOCUMENTATION_LABELS = toMap(DOCUMENTATION_OPTIONS);
export const COURSE_LABELS = toMap(COURSE_OPTIONS);

/** Rótulos dos campos usados no histórico. */
export const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  cpf: "CPF",
  region: "Região",
  segment: "Ramo",
  source: "Origem",
  availability: "Disponibilidade",
  currently_working: "Trabalha atualmente",
  notes: "Observação",
  status: "Status",
  manager: "Gerente",
  responsible: "Responsável",
  interview_at: "Data da entrevista",
  integration_date: "Data de integração",
  integration_planned_date: "Integração prevista",
  documentation_status: "Cadastro/documentação",
  documentation_notes: "Observações de documentação",
  course_status: "Curso",
  course_notes: "Observações do curso",
  cavaplay: "Cavaplay",
  course_paid_by_cava: "Curso pago pela Cava",
  task: "Tarefa",
  document: "Documento",
};

/** Traduz valores técnicos gravados no histórico (enum/booleano) para texto. */
export function historyValueLabel(field: string | null, value: string | null): string | null {
  if (value === null) return null;
  switch (field) {
    case "availability":
      return AVAILABILITY_LABELS[value] ?? value;
    case "documentation_status":
      return DOCUMENTATION_LABELS[value] ?? value;
    case "course_status":
      return COURSE_LABELS[value] ?? value;
    case "currently_working":
    case "cavaplay":
    case "course_paid_by_cava":
      return value === "true" ? "Sim" : value === "false" ? "Não" : value;
    default:
      return value;
  }
}
