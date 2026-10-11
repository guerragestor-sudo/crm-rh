import type { Metadata } from "next";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { formatCpf } from "@/lib/cpf";
import { formatPhone } from "@/lib/phone";
import { CandidateForm } from "@/modules/candidates/components/candidate-form";
import { getCandidate, getCandidateOptions } from "@/modules/candidates/queries";
import { isoToLocalDateTime, type CandidateFormValues } from "@/modules/candidates/schema";
import { requirePermission } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Editar candidato" };

export default async function EditCandidatePage({ params }: PageProps<"/candidatos/[id]/editar">) {
  await requirePermission("candidates.write");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [candidate, options, context] = await Promise.all([getCandidate(id), getCandidateOptions(), getAppContext()]);
  if (!candidate) notFound();
  if (candidate.archived_at) redirect(`/candidatos/${id}`);

  const values: CandidateFormValues = {
    full_name: candidate.full_name,
    phone: candidate.phone ? formatPhone(candidate.phone) : "",
    email: candidate.email ?? "",
    cpf: candidate.cpf ? formatCpf(candidate.cpf) : "",
    region_id: candidate.region_id ?? "",
    segment_id: candidate.segment_id ?? "",
    availability: (candidate.availability ?? "") as CandidateFormValues["availability"],
    currently_working: candidate.currently_working === null ? "" : candidate.currently_working ? "yes" : "no",
    source_id: candidate.source_id ?? "",
    manager_id: candidate.manager_id ?? "",
    status_id: candidate.status_id,
    notes: candidate.notes ?? "",
    interview_at: isoToLocalDateTime(candidate.interview_at, context.timezone),
    integration_date: candidate.integration_date ?? "",
    documentation_status: candidate.documentation_status as CandidateFormValues["documentation_status"],
    documentation_notes: candidate.documentation_notes ?? "",
    course_status: candidate.course_status as CandidateFormValues["course_status"],
    course_notes: candidate.course_notes ?? "",
    status_reason: "",
    manager_reason: "",
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Editar candidato" description={candidate.full_name} />
      <CandidateForm mode="edit" candidateId={id} defaultValues={values} options={options} today={context.today} />
    </PageContainer>
  );
}
