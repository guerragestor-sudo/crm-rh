import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

import type { Release } from "../releases";

/** Todas as novidades, da mais nova para a mais antiga (página /novidades). */
export function ReleaseList({ releases }: { releases: Release[] }) {
  if (releases.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma novidade por enquanto.</p>;
  }

  return (
    <div className="space-y-8">
      {releases.map((release) => (
        <section key={release.id} aria-labelledby={`release-${release.id}`} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{formatDate(release.date)}</p>
              <h2 id={`release-${release.id}`} className="text-base font-semibold">
                {release.title}
              </h2>
            </div>
            {release.action ? (
              <Button asChild variant="outline" className="h-10 self-start sm:self-auto">
                <Link href={release.action.href}>
                  {release.action.label}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {release.cards.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.title} className="flex gap-3 rounded-xl border bg-card p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{card.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
