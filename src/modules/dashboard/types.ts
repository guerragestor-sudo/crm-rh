export type CountItem = { id: string | null; name: string; count: number };
export type StatusCountItem = CountItem & { color: string };

export type SlaStats = {
  completed_count: number;
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  waiting_count: number;
  waiting_avg: number | null;
  waiting_median: number | null;
  above_target: number | null;
};

export type MonthPoint = {
  month: string;
  new: number;
  integrations: number;
  sla_avg: number | null;
  sla_median: number | null;
};

export type DashboardSummary = {
  today: string;
  sla_target_days: number | null;
  totals: {
    active: number;
    new_7_days: number;
    interviews_upcoming: number;
    interviews_today: number;
    integrations: number;
    integrations_this_month: number;
    overdue_tasks: number;
    today_tasks: number;
    no_next_action: number;
  };
  sla: SlaStats;
  by_status: StatusCountItem[];
  by_source: CountItem[];
  by_region: CountItem[];
  by_manager: CountItem[];
  by_month: MonthPoint[];
};
