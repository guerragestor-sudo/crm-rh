import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { LookupList, ManagerList, SlaTargetForm, StatusList } from "@/modules/settings/components/settings-lists";
import { requirePermission } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Configurações" };

const TABS = [
  { value: "status", label: "Status" },
  { value: "managers", label: "Gerentes" },
  { value: "regions", label: "Regiões" },
  { value: "segments", label: "Ramos" },
  { value: "sources", label: "Origens" },
  { value: "sla", label: "SLA" },
] as const;

export default async function SettingsPage({ searchParams }: PageProps<"/configuracoes">) {
  await requirePermission("settings.manage");
  const [{ tab }, options, context] = await Promise.all([searchParams, getCandidateOptions(), getAppContext()]);
  const initialTab = TABS.some((item) => item.value === tab) ? (tab as string) : "status";

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Configurações" description="Listas usadas no cadastro, nos filtros e nos relatórios." />
      <Tabs defaultValue={initialTab} className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="status">
          <StatusList items={options.statuses} />
        </TabsContent>
        <TabsContent value="managers">
          <ManagerList items={options.managers} />
        </TabsContent>
        <TabsContent value="regions">
          <LookupList kind="regions" items={options.regions} />
        </TabsContent>
        <TabsContent value="segments">
          <LookupList kind="segments" items={options.segments} />
        </TabsContent>
        <TabsContent value="sources">
          <LookupList kind="sources" items={options.sources} />
        </TabsContent>
        <TabsContent value="sla">
          <SlaTargetForm value={context.slaTargetDays} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
