"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/shared/native-select";
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

import { changeManagerAction } from "../actions";
import type { ManagerOption } from "../types";

export function ChangeManagerDialog({
  candidateId,
  currentManagerId,
  managers,
  trigger,
}: {
  candidateId: string;
  currentManagerId: string | null;
  managers: ManagerOption[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentManagerId ?? "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const unchanged = selected === (currentManagerId ?? "");

  function submit() {
    startTransition(async () => {
      const response = await changeManagerAction(candidateId, selected || null, reason);
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      toast.success("Gerente atualizado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSelected(currentManagerId ?? "");
          setReason("");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar gerente</DialogTitle>
          <DialogDescription>
            Gerente para quem o candidato será direcionado. O gerente anterior, o novo e o motivo ficam no histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="manager-select">Gerente</Label>
          <NativeSelect id="manager-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Sem gerente</option>
            {managers
              .filter((manager) => manager.is_active || manager.id === currentManagerId)
              .map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manager-reason">Motivo (opcional)</Label>
          <Textarea
            id="manager-reason"
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
          <Button className="h-11" onClick={submit} disabled={pending || unchanged}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Salvar gerente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
