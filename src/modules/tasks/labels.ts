import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileSearch,
  Mail,
  MessageCircle,
  Phone,
  Repeat,
  Send,
  type LucideIcon,
} from "lucide-react";

export const TASK_TYPES = [
  { value: "call", label: "Ligação", icon: Phone, verb: "Ligar para" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, verb: "Mandar WhatsApp para" },
  { value: "email", label: "E-mail", icon: Mail, verb: "Enviar e-mail para" },
  { value: "interview", label: "Entrevista", icon: CalendarClock, verb: "Entrevista com" },
  { value: "request_document", label: "Solicitar documento", icon: FileSearch, verb: "Solicitar documentos de" },
  { value: "course", label: "Curso", icon: BookOpen, verb: "Acompanhar curso de" },
  { value: "referral", label: "Encaminhamento", icon: Send, verb: "Encaminhar" },
  { value: "follow_up", label: "Follow-up", icon: Repeat, verb: "Retornar para" },
  { value: "custom", label: "Tarefa personalizada", icon: ClipboardList, verb: "" },
] as const satisfies readonly { value: string; label: string; icon: LucideIcon; verb: string }[];

export type TaskType = (typeof TASK_TYPES)[number]["value"];

export const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.map((type) => [type.value, type])) as Record<
  TaskType,
  (typeof TASK_TYPES)[number]
>;

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
] as const;

export type TaskPriority = (typeof PRIORITY_OPTIONS)[number]["value"];

/** Título sugerido ao escolher o tipo (o usuário pode editar). */
export function suggestedTitle(type: TaskType, candidateName?: string): string {
  const entry = TASK_TYPE_MAP[type];
  if (!entry.verb) return "";
  const firstName = candidateName?.split(" ")[0];
  return firstName ? `${entry.verb} ${firstName}` : entry.label;
}

export const AGENDA_VIEWS = [
  { value: "overdue", label: "Atrasadas" },
  { value: "today", label: "Hoje" },
  { value: "upcoming", label: "Próximas" },
  { value: "done", label: "Concluídas" },
  { value: "no_next_action", label: "Sem próxima ação" },
] as const;

export type AgendaView = (typeof AGENDA_VIEWS)[number]["value"];
