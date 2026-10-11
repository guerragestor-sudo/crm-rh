import type { ReactNode } from "react";

import { formatCpf } from "@/lib/cpf";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

import { AVAILABILITY_LABELS, COURSE_LABELS, DOCUMENTATION_LABELS } from "../labels";
import type { CandidateDetail } from "../types";

function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm [overflow-wrap:anywhere]">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

export function CandidateDetails({
  candidate,
  responsibleName,
  timezone,
}: {
  candidate: CandidateDetail;
  responsibleName: string | null;
  timezone: string;
}) {
  const working =
    candidate.currently_working === null ? null : candidate.currently_working ? "Sim" : "Não";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Group title="Contato">
        <Item label="Telefone / WhatsApp">{candidate.phone ? formatPhone(candidate.phone) : null}</Item>
        <Item label="E-mail">{candidate.email}</Item>
        <Item label="CPF">{candidate.cpf ? formatCpf(candidate.cpf) : null}</Item>
      </Group>
      <Group title="Perfil">
        <Item label="Região">{candidate.region?.name}</Item>
        <Item label="Ramo">{candidate.segment?.name}</Item>
        <Item label="Disponibilidade">{candidate.availability ? AVAILABILITY_LABELS[candidate.availability] : null}</Item>
        <Item label="Trabalha atualmente">{working}</Item>
        <Item label="Origem / captação">{candidate.source?.name}</Item>
      </Group>
      <Group title="Cadastro e documentação">
        <Item label="Situação">{DOCUMENTATION_LABELS[candidate.documentation_status]}</Item>
        <Item label="Informações" wide>
            {candidate.documentation_notes ? <span className="whitespace-pre-line">{candidate.documentation_notes}</span> : null}
        </Item>
      </Group>
      <Group title="Curso">
        <Item label="Situação">{COURSE_LABELS[candidate.course_status]}</Item>
        <Item label="Informações" wide>
            {candidate.course_notes ? <span className="whitespace-pre-line">{candidate.course_notes}</span> : null}
        </Item>
      </Group>
      <section className="rounded-xl border bg-card p-4 shadow-xs md:col-span-2">
        <h3 className="mb-2 text-sm font-semibold">Observação</h3>
        <p className="text-sm whitespace-pre-line">
          {candidate.notes ?? <span className="text-muted-foreground">Sem observações.</span>}
        </p>
      </section>
      <Group title="Controle">
        <Item label="Responsável">{responsibleName}</Item>
        <Item label="Cadastrado em">{formatDateTime(candidate.created_at, timezone)}</Item>
        <Item label="Status desde">{formatDateTime(candidate.status_changed_at, timezone)}</Item>
        <Item label="Última atualização">{formatDateTime(candidate.updated_at, timezone)}</Item>
      </Group>
    </div>
  );
}
