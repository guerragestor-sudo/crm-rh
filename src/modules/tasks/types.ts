export type TaskRow = {
  id: string;
  candidate_id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  responsible_member_id: string;
  candidate: { id: string; full_name: string; phone: string | null } | null;
  responsible: { profiles: { full_name: string } | null } | null;
};
