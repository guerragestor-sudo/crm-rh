import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { ImportWizard } from "@/modules/imports/components/import-wizard";
import { RecentImports } from "@/modules/imports/components/recent-imports";
import { getRecentImports } from "@/modules/imports/queries";
import type { RefOptions } from "@/modules/imports/resolve";
import { requirePermission } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Importar planilha" };

export default async function ImportPage() {
  const member = await requirePermission("candidates.write");
  const [options, context, imports] = await Promise.all([getCandidateOptions(), getAppContext(), getRecentImports()]);

  const refOptions: RefOptions = {
    status: options.statuses,
    manager: options.managers,
    region: options.regions,
    source: options.sources,
    segment: options.segments,
  };
  const memberNames = Object.fromEntries(options.members.map((item) => [item.id, item.name]));

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        title="Importar planilha"
        description="Crie vários candidatos de uma vez. Confira e corrija na prévia antes de gravar."
      />
      <ImportWizard
        options={refOptions}
        defaultStatusId={options.statuses.find((status) => status.is_active)?.id ?? ""}
        today={context.today}
        canCreate={member.role === "admin"}
      />
      <RecentImports
        imports={imports}
        memberNames={memberNames}
        currentMemberId={member.memberId}
        isAdmin={member.role === "admin"}
        timezone={context.timezone}
      />
    </PageContainer>
  );
}
