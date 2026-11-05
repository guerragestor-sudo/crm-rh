"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { markUpdatesSeenAction } from "../actions";
import { RELEASES } from "../releases";

/**
 * Pop-up rápido de novidades, logo depois do login. Recebe só os ids (o
 * conteúdo, com os ícones, está em releases.ts). Fechar de qualquer jeito
 * (Entendi, X, Esc, fora da janela ou o botão da novidade) marca como visto.
 */
export function WhatsNewDialog({ releaseIds }: { releaseIds: number[] }) {
  const steps = useMemo(
    () =>
      releaseIds.flatMap((id) => {
        const release = RELEASES.find((item) => item.id === id);
        if (!release) return [];
        return release.cards.map((card, index) => ({
          release,
          card,
          isLastOfRelease: index === release.cards.length - 1,
        }));
      }),
    [releaseIds],
  );
  const [open, setOpen] = useState(steps.length > 0);
  const [index, setIndex] = useState(0);

  if (steps.length === 0) return null;

  const step = steps[Math.min(index, steps.length - 1)];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const Icon = step.card.icon;
  const newest = Math.max(...releaseIds);

  function close() {
    setOpen(false);
    // Se falhar, o pop-up só volta a aparecer no próximo acesso: não vale incomodar com erro.
    void markUpdatesSeenAction(newest);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-primary/5 px-6 pt-6 pb-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            Novidade no CRM · {step.release.title}
            <span className="font-normal text-muted-foreground">· {formatDate(step.release.date)}</span>
          </p>
          <div className="mt-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Icon className="size-6" aria-hidden />
          </div>
        </div>

        <div className="min-h-40 px-6 pt-5 pb-6">
          <DialogTitle className="text-lg leading-snug">{step.card.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step.card.body}
          </DialogDescription>
          {step.isLastOfRelease && step.release.action ? (
            <Button asChild variant="outline" className="mt-4 h-10">
              <Link href={step.release.action.href} onClick={close}>
                {step.release.action.label}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <div className="flex items-center gap-2">
            <ol className="flex items-center gap-1.5" aria-hidden>
              {steps.map((_, dot) => (
                <li
                  key={dot}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    dot === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                  )}
                />
              ))}
            </ol>
            <span className="text-xs text-muted-foreground">
              {index + 1} de {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isFirst ? null : (
              <Button variant="ghost" className="h-10" onClick={() => setIndex(index - 1)}>
                <ArrowLeft aria-hidden />
                <span className="sr-only sm:not-sr-only">Voltar</span>
              </Button>
            )}
            {isLast ? (
              <Button className="h-10" onClick={close}>
                Entendi
              </Button>
            ) : (
              <Button className="h-10" onClick={() => setIndex(index + 1)}>
                Próximo
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
