import "server-only";

import { cache } from "react";

import { DEFAULT_TIMEZONE } from "@/lib/format";
import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

export type AppContext = {
  today: string;
  nowTime: string;
  timezone: string;
  slaTargetDays: number | null;
};

/** "Hoje", hora atual e fuso da organização (calculados no banco). Memoizado por requisição. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_context");
  if (error) throw fromDatabaseError(error, { op: "app_context" });
  const context = data as { today: string; now_time: string; timezone: string; sla_target_days: number | null };
  return {
    today: context.today,
    nowTime: context.now_time,
    timezone: context.timezone ?? DEFAULT_TIMEZONE,
    slaTargetDays: context.sla_target_days,
  };
});
