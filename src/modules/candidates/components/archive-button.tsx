"use client";

import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
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

import { setArchivedAction } from "../actions";

export function ArchiveButton({ candidateId, archived }: { candidateId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const response = await setArchivedAction(candidateId, !archived);
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      toast.success(archived ? "Candidato restaurado." : "Candidato arquivado.");
      router.refresh();
    });
  }

  if (archived) {
    return (
      <Button variant="outline" className="h-10" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArchiveRestore aria-hidden />}
        Restaurar
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="h-10 text-muted-foreground">
          <Archive aria-hidden />
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar candidato?</AlertDialogTitle>
          <AlertDialogDescription>
            Ele sai das listas, do Kanban e dos indicadores, mas o histórico é preservado e você pode restaurá-lo depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="h-11" onClick={run}>
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
