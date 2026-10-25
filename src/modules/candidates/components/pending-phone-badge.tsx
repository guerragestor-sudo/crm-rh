import { PhoneOff } from "lucide-react";

import { cn } from "@/lib/utils";

/** Candidato sem telefone (ex.: importado da planilha): completar na edição da ficha. */
export function PendingPhoneBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800",
        className,
      )}
    >
      <PhoneOff className="size-3" aria-hidden />
      Telefone pendente
    </span>
  );
}
