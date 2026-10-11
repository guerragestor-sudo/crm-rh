import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { CandidateForm } from "@/modules/candidates/components/candidate-form";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { emptyCandidateForm } from "@/modules/candidates/schema";
import { requirePermission } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Novo candidato" };

export default async function NewCandidatePage() {
  await requirePermission("candidates.write");
  const [options, context] = await Promise.all([getCandidateOptions(), getAppContext()]);
  const defaultStatus = options.statuses.find((status) => status.is_active)?.id ?? "";

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Novo candidato" description="Só nome e um contato são obrigatórios. Complete o resto depois." />
      <CandidateForm
        mode="create"
        defaultValues={emptyCandidateForm(defaultStatus)}
        options={options}
        today={context.today}
      />
    </PageContainer>
  );
}
