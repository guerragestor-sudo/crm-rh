import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { CandidateBrowser } from "@/modules/candidates/components/candidate-browser";
import { filtersFromSearchParams } from "@/modules/candidates/filters";
import { getCandidateOptions, listCandidates } from "@/modules/candidates/queries";
import { SORT_OPTIONS, type SortKey } from "@/modules/candidates/types";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Candidatos" };

export default async function CandidatesPage({ searchParams }: PageProps<"/candidatos">) {
  const member = await requireMember();
  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const sortParam = typeof params.sort === "string" ? params.sort : "recent";
  const sort = (SORT_OPTIONS.some((option) => option.value === sortParam) ? sortParam : "recent") as SortKey;

  const [context, options, initial] = await Promise.all([
    getAppContext(),
    getCandidateOptions(),
    listCandidates({ filters, sort }),
  ]);

  const filterFields = can(member.role, "candidates.archive")
    ? (["status", "region", "manager", "source", "segment", "created", "integration", "tasks", "cava", "archived"] as const)
    : (["status", "region", "manager", "source", "segment", "created", "integration", "tasks", "cava"] as const);

  return (
    <PageContainer>
      <PageHeader
        title="Candidatos"
        description="Busque, filtre e acompanhe sua base."
        actions={
          <Button asChild className="hidden h-10 md:inline-flex">
            <Link href="/candidatos/novo">
              <Plus aria-hidden />
              Novo candidato
            </Link>
          </Button>
        }
      />
      <CandidateBrowser
        initial={initial}
        initialFilters={filters}
        initialSort={sort}
        options={options}
        today={context.today}
        nowTime={context.nowTime}
        timezone={context.timezone}
        slaTarget={context.slaTargetDays}
        filterFields={[...filterFields]}
        canExport={can(member.role, "candidates.export")}
      />
    </PageContainer>
  );
}
