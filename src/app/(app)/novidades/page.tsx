import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ReleaseList } from "@/modules/updates/components/release-list";
import { releasesFor } from "@/modules/updates/releases";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Novidades" };

export default async function UpdatesPage() {
  const member = await requireMember();
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Novidades" description="O que mudou no CRM, da mais nova para a mais antiga." />
      <ReleaseList releases={releasesFor(member.role)} />
    </PageContainer>
  );
}
