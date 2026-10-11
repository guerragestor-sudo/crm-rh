"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { statusDotClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

import { changeStatusAction } from "../actions";
import type { StatusOption } from "../types";

export function ChangeStatusDialog({
  candidateId,
  currentStatusId,
  statuses,
  trigger,
  onChanged,
}: {
  candidateId: string;
  currentStatusId: string;
  statuses: StatusOption[];
  trigger: ReactNode;
  onChanged?: (statusId: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentStatusId);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const response = await changeStatusAction(candidateId, selected, reason);
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      toast.success("Status atualizado.");
      setOpen(false);
      onChanged?.(selected);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSelected(currentStatusId);
          setReason("");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
          <DialogDescription>A mudança fica registrada no histórico.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Status" className="grid gap-1.5">
          {statuses
            .filter((status) => status.is_active || status.id === currentStatusId)
            .map((status) => {
              const active = status.id === selected;
              return (
                <button
                  key={status.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(status.id)}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-sm",
                    active ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", statusDotClass(status.color))} aria-hidden />
                  <span className="flex-1">{status.name}</span>
                  {status.id === currentStatusId ? <span className="text-xs text-muted-foreground">atual</span> : null}
                  {active ? <Check className="size-4 text-primary" aria-hidden /> : null}
                </button>
              );
            })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status-reason">Motivo (opcional)</Label>
          <Textarea
            id="status-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="text-base md:text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={submit} disabled={pending || selected === currentStatusId}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Salvar status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
