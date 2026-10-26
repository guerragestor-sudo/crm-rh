import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { DEFAULT_TIMEZONE } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

import { AVAILABILITY_OPTIONS, COURSE_OPTIONS, DOCUMENTATION_OPTIONS } from "./labels";

/**
 * Formulário do candidato: todos os campos como string (como chegam dos inputs).
 * O MESMO schema valida no navegador e no servidor; a conversão para o formato
 * do banco fica em toCandidateWrite().
 *
 * Telefone e e-mail são opcionais: sem telefone, a ficha fica com "telefone
 * pendente". Telefone (ou CPF) repetido é bloqueado no servidor.
 */
const optionalId = z.union([z.literal(""), z.uuid({ error: "Seleção inválida." })]);
const optionalText = (max: number) => z.string().trim().max(max, { error: `Máximo de ${max} caracteres.` });

function enumOrEmpty<const T extends readonly { value: string }[]>(options: T) {
  return z.union([z.literal(""), z.enum(options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]])]);
}

export const candidateFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome completo." })
    .max(150, { error: "Máximo de 150 caracteres." }),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || normalizePhone(value) !== null, { error: "Telefone inválido. Use DDD + número." }),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email({ error: "E-mail inválido." }))]),
  cpf: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCpf(value), { error: "CPF inválido." }),
  region_id: optionalId,
  segment_id: optionalId,
  availability: enumOrEmpty(AVAILABILITY_OPTIONS),
  currently_working: z.enum(["", "yes", "no"]),
  source_id: optionalId,
  manager_id: optionalId,
  status_id: z.uuid({ error: "Selecione o status." }),
  notes: optionalText(5000),
  interview_at: z
    .string()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), { error: "Data inválida." }),
  integration_date: z.union([z.literal(""), z.iso.date({ error: "Data inválida." })]),
  integration_planned_date: z.union([z.literal(""), z.iso.date({ error: "Data inválida." })]),
  documentation_status: z.enum(DOCUMENTATION_OPTIONS.map((option) => option.value) as ["pending", "in_progress", "complete"]),
  documentation_notes: optionalText(2000),
  course_status: z.enum(COURSE_OPTIONS.map((option) => option.value) as ["not_started", "in_progress", "completed"]),
  course_notes: optionalText(2000),
  cavaplay: z.enum(["no", "yes"]),
  course_paid_by_cava: z.enum(["no", "yes"]),
  // Motivos opcionais quando status/gerente mudam na edição.
  status_reason: optionalText(500),
  manager_reason: optionalText(500),
});

export type CandidateFormValues = z.infer<typeof candidateFormSchema>;

export const emptyCandidateForm = (statusId = ""): CandidateFormValues => ({
  full_name: "",
  phone: "",
  email: "",
  cpf: "",
  region_id: "",
  segment_id: "",
  availability: "",
  currently_working: "",
  source_id: "",
  manager_id: "",
  status_id: statusId,
  notes: "",
  interview_at: "",
  integration_date: "",
  integration_planned_date: "",
  documentation_status: "pending",
  documentation_notes: "",
  course_status: "not_started",
  course_notes: "",
  cavaplay: "no",
  course_paid_by_cava: "no",
  status_reason: "",
  manager_reason: "",
});

/** Campos por etapa do formulário no celular (validação parcial ao avançar). */
export const FORM_STEPS = [
  { title: "Dados pessoais", fields: ["full_name", "phone", "email", "cpf"] },
  { title: "Perfil", fields: ["region_id", "segment_id", "availability", "currently_working", "source_id"] },
  { title: "Processo", fields: ["status_id", "manager_id", "interview_at", "integration_planned_date", "integration_date", "notes"] },
  {
    title: "Cadastro e curso",
    fields: ["documentation_status", "documentation_notes", "course_status", "course_notes", "cavaplay", "course_paid_by_cava"],
  },
] as const satisfies readonly { title: string; fields: readonly (keyof CandidateFormValues)[] }[];

const emptyToNull = (value: string) => (value === "" ? null : value);

/** "2026-10-08T14:30" no fuso da organização → ISO UTC */
export function localDateTimeToIso(value: string, timeZone = DEFAULT_TIMEZONE): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(new TZDate(year, month - 1, day, hour, minute, timeZone).getTime()).toISOString();
}

/** ISO UTC → "2026-10-08T14:30" no fuso da organização (para input datetime-local) */
export function isoToLocalDateTime(value: string | null, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "";
  const date = new TZDate(value, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converte o formulário validado para as colunas do banco (normalizadas). */
export function toCandidateWrite(values: CandidateFormValues, timeZone = DEFAULT_TIMEZONE) {
  return {
    full_name: values.full_name.trim().replace(/\s+/g, " "),
    phone: values.phone ? normalizePhone(values.phone) : null,
    email: emptyToNull(values.email.trim().toLowerCase()),
    cpf: values.cpf ? onlyDigits(values.cpf) : null,
    region_id: emptyToNull(values.region_id),
    segment_id: emptyToNull(values.segment_id),
    availability: emptyToNull(values.availability),
    currently_working: values.currently_working === "" ? null : values.currently_working === "yes",
    source_id: emptyToNull(values.source_id),
    notes: emptyToNull(values.notes.trim()),
    interview_at: localDateTimeToIso(values.interview_at, timeZone),
    integration_date: emptyToNull(values.integration_date),
    integration_planned_date: emptyToNull(values.integration_planned_date),
    documentation_status: values.documentation_status,
    documentation_notes: emptyToNull(values.documentation_notes.trim()),
    course_status: values.course_status,
    course_notes: emptyToNull(values.course_notes.trim()),
    cavaplay: values.cavaplay === "yes",
    course_paid_by_cava: values.course_paid_by_cava === "yes",
  };
}

export type CandidateWrite = ReturnType<typeof toCandidateWrite>;

/**
 * A data de integração é o dia em que o candidato começou: não pode ser futura
 * (o banco também barra). Data combinada vai em "Integração prevista".
 */
export const FUTURE_INTEGRATION_MESSAGE =
  "Data futura: use “Integração prevista”. A data de integração é o dia em que o candidato começou.";

export function isFutureIntegration(values: Pick<CandidateFormValues, "integration_date">, today: string) {
  return values.integration_date !== "" && values.integration_date > today;
}

export const reasonSchema = z.string().trim().max(500, { error: "Máximo de 500 caracteres." });
