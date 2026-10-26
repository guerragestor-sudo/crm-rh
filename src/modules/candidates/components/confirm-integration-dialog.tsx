"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { inputClass } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

import { confirmIntegrationAction } from "../actions";

/**
 * "Em que dia o candidato começou?" — parte da data prevista (ou de hoje, se a
 * prevista ainda não chegou). Ao confirmar, o SLA congela e a prevista some.
 */
export function ConfirmIntegrationDialog({
  candidateId,
  candidateName,
  plannedDate,
  today,
  trigger,
}: {
  candidateId: string;
  candidateName: string;
  plannedDate: string | null;
  today: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const initial = plannedDate && plannedDate <= today ? plannedDate : today;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initial);
  const [pending, startTransition] = useTransition();
  const future = date > today;

  function submit() {
    startTransition(async () => {
      const response = await confirmIntegrationAction(candidateId, date);
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      toast.success(`Integração de ${candidateName} confirmada em ${formatDate(date)}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDate(initial);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar integração</DialogTitle>
          <DialogDescription>
            {plannedDate ? `Prevista para ${formatDate(plannedDate)}. ` : ""}
            Informe o dia em que {candidateName} começou. O SLA é congelado nessa data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`confirm-integration-${candidateId}`}>Dia em que começou</Label>
          <Input
            id={`confirm-integration-${candidateId}`}
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
            aria-invalid={future}
          />
          {future ? <p className="text-sm text-destructive">A integração não pode ser futura.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={submit} disabled={pending || !date || future}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Confirmar integração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
