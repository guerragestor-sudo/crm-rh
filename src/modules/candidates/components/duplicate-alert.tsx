import { AlertTriangle, Ban } from "lucide-react";
import Link from "next/link";

import type { DuplicateMatch } from "../types";

const MATCH_LABEL: Record<DuplicateMatch["match"], string> = {
  cpf: "mesmo CPF",
  phone: "mesmo telefone",
  email: "mesmo e-mail",
};

export function DuplicateAlert({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;
  const blocking = matches.filter((match) => match.match === "cpf");
  const warnings = matches.filter((match) => match.match !== "cpf");

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {blocking.map((match) => (
        <div key={match.id} className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            CPF já cadastrado para{" "}
            <Link href={`/candidatos/${match.id}`} className="font-medium underline" target="_blank">
              {match.full_name}
            </Link>{" "}
            ({match.status_name}
            {match.archived ? ", arquivado" : ""}). Não é possível cadastrar novamente.
          </p>
        </div>
      ))}
      {warnings.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Possível duplicidade</p>
            <ul className="mt-1 space-y-0.5">
              {warnings.map((match) => (
                <li key={match.id}>
                  <Link href={`/candidatos/${match.id}`} className="underline" target="_blank">
                    {match.full_name}
                  </Link>{" "}
                  · {MATCH_LABEL[match.match]} · {match.status_name}
                  {match.archived ? " (arquivado)" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Você pode continuar se for outra pessoa.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
