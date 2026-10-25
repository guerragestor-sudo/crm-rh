export type Option = { id: string; name: string; is_active: boolean };
export type StatusOption = Option & { color: string; position: number };
export type ManagerOption = Option & { phone: string | null; email: string | null };
export type MemberOption = { id: string; name: string };

export type CandidateOptions = {
  statuses: StatusOption[];
  regions: Option[];
  segments: Option[];
  sources: Option[];
  managers: ManagerOption[];
  members: MemberOption[];
};

export type NextTask = {
  id: string;
  title: string;
  type: string;
  due_date: string;
  due_time: string | null;
};

export type CandidateListRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  interview_at: string | null;
  integration_date: string | null;
  archived_at: string | null;
  sla_days: number;
  status: { id: string; name: string; color: string } | null;
  region: { name: string } | null;
  manager: { id: string; name: string } | null;
  source: { name: string } | null;
  next_task: NextTask | null;
};

export const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name", label: "Nome (A–Z)" },
  { value: "status_changed", label: "Status alterado recentemente" },
  { value: "integration_recent", label: "Integração mais recente" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type CandidateListResult = { rows: CandidateListRow[]; total: number; page: number; pageSize: number };

export type CandidateDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  region_id: string | null;
  segment_id: string | null;
  availability: string | null;
  currently_working: boolean | null;
  source_id: string | null;
  manager_id: string | null;
  notes: string | null;
  status_id: string;
  status_changed_at: string;
  interview_at: string | null;
  integration_date: string | null;
  documentation_status: string;
  documentation_notes: string | null;
  course_status: string;
  course_notes: string | null;
  cavaplay: boolean;
  course_paid_by_cava: boolean;
  sla_days: number;
  sla_days_frozen: number | null;
  responsible_member_id: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  status: { id: string; name: string; color: string } | null;
  region: { name: string } | null;
  segment: { name: string } | null;
  source: { name: string } | null;
  manager: { id: string; name: string; phone: string | null } | null;
};

export type HistoryEntry = {
  id: number;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
};

export type DuplicateMatch = {
  id: string;
  full_name: string;
  match: "cpf" | "phone" | "email";
  status_name: string;
  archived: boolean;
};
