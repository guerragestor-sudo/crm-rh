import "server-only";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { DEFAULT_TIMEZONE } from "@/lib/format";
import type { CurrentMember } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { createClient } from "@/server/supabase/server";

import { unseenReleases } from "./releases";

/**
 * Ids das novidades que o pop-up deve mostrar. Nunca derruba a página: se a
 * leitura falhar (ex.: banco ainda sem a coluna), simplesmente não mostra nada.
 */
export async function getUnseenReleaseIds(member: CurrentMember): Promise<number[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("updates_seen, created_at")
      .eq("id", member.memberId)
      .maybeSingle();
    if (error || !data) {
      if (error) logger.warn("updates_seen_read_failed", { code: error.code });
      return [];
    }
    const memberSince = format(new TZDate(data.created_at, DEFAULT_TIMEZONE), "yyyy-MM-dd");
    return unseenReleases({ role: member.role, seen: data.updates_seen, memberSince }).map((release) => release.id);
  } catch {
    logger.warn("updates_seen_read_failed", { code: "exception" });
    return [];
  }
}
