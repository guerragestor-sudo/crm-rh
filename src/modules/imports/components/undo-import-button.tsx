"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { undoImportAction } from "../actions";

/** Apaga os candidatos de uma importação (até 7 dias depois). Pede confirmação. */
export function UndoImportButton({
  importId,
  fileName,
  rowCount,
  onUndone,
}: {
  importId: string;
  fileName: string;
  rowCount: number;
  onUndone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const response = await undoImportAction(importId);
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      const { deleted } = response.data;
      toast.success(deleted === 1 ? "Importação desfeita: 1 candidato apagado." : `Importação desfeita: ${deleted} candidatos apagados.`);
      onUndone?.();
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-9" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          Desfazer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desfazer a importação de “{fileName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {rowCount === 1 ? "O candidato importado será apagado" : `Os ${rowCount} candidatos importados serão apagados`}, com as
            tarefas e o histórico. Alterações feitas neles depois da importação também se perdem. Gerentes, regiões e origens
            criados na importação continuam cadastrados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="h-11" onClick={run}>
            Desfazer importação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
