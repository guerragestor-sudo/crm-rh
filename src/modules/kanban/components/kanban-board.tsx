"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, Columns3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/format";
import { statusDotClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { changeStatusAction } from "@/modules/candidates/actions";
import { FilterSheet } from "@/modules/candidates/components/filter-sheet";
import { filtersToSearchParams, type CandidateFilters } from "@/modules/candidates/filters";
import type { CandidateListRow, CandidateOptions, StatusOption } from "@/modules/candidates/types";

import { KanbanCard } from "./kanban-card";

type BoardProps = {
  rows: CandidateListRow[];
  total: number;
  limit: number;
  options: CandidateOptions;
  filters: CandidateFilters;
  today: string;
  nowTime: string;
  slaTarget: number | null;
};

function MoveMenu({
  candidate,
  statuses,
  onMove,
}: {
  candidate: CandidateListRow;
  statuses: StatusOption[];
  onMove: (candidateId: string, statusId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Mover ${candidate.full_name}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ArrowRightLeft aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mover para</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {statuses
          .filter((status) => status.is_active && status.id !== candidate.status?.id)
          .map((status) => (
            <DropdownMenuItem key={status.id} onSelect={() => onMove(candidate.id, status.id)} className="h-10">
              <span className={cn("size-2.5 rounded-full", statusDotClass(status.color))} aria-hidden />
              {status.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DraggableCard({
  candidate,
  children,
}: {
  candidate: CandidateListRow;
  children: React.ReactNode;
}) {
  // Só os listeners de ponteiro: o cartão não vira um "botão" que contém links
  // (controles aninhados). No teclado, a mudança de status é feita pelo menu ⇄.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: candidate.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn("cursor-grab touch-none select-none active:cursor-grabbing", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: StatusOption;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${status.name}: ${count} candidatos`}
      className={cn(
        "flex max-h-[calc(100dvh-14rem)] w-72 shrink-0 flex-col rounded-xl bg-muted/60 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(status.color))} aria-hidden />
          <span className="truncate">{status.name}</span>
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">{children}</div>
    </section>
  );
}

export function KanbanBoard({ rows: initialRows, total, limit, options, filters, today, nowTime, slaTarget }: BoardProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dndId = useId();

  const columns = useMemo(() => {
    const used = new Set(rows.map((row) => row.status?.id));
    return options.statuses.filter((status) => status.is_active || used.has(status.id));
  }, [options.statuses, rows]);

  const [mobileStatus, setMobileStatus] = useState<string>(columns[0]?.id ?? "");

  const byStatus = useMemo(() => {
    const map = new Map<string, CandidateListRow[]>();
    for (const status of columns) map.set(status.id, []);
    for (const row of rows) map.get(row.status?.id ?? "")?.push(row);
    return map;
  }, [rows, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function move(candidateId: string, statusId: string) {
    const candidate = rows.find((row) => row.id === candidateId);
    const status = options.statuses.find((item) => item.id === statusId);
    if (!candidate || !status || candidate.status?.id === statusId) return;

    const previous = rows;
    // Atualização otimista: o cartão vai para o topo da nova coluna.
    setRows((current) => [
      { ...candidate, status: { id: status.id, name: status.name, color: status.color } },
      ...current.filter((row) => row.id !== candidateId),
    ]);

    startTransition(async () => {
      const response = await changeStatusAction(candidateId, statusId);
      if (!response.ok) {
        setRows(previous);
        toast.error(response.error.message);
        return;
      }
      toast.success(`${candidate.full_name} → ${status.name}`);
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (event.over) move(String(event.active.id), String(event.over.id));
  }

  function applyFilters(next: CandidateFilters) {
    const params = filtersToSearchParams(next).toString();
    router.push(params ? `/kanban?${params}` : "/kanban");
  }

  const activeCandidate = activeId ? rows.find((row) => row.id === activeId) : null;
  const cardProps = { today, nowTime, slaTarget };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} {total === 1 ? "candidato" : "candidatos"}
          {total > limit ? ` (exibindo ${formatNumber(limit)}; use os filtros para refinar)` : ""}
        </p>
        <FilterSheet
          value={filters}
          onApply={applyFilters}
          options={options}
          fields={["region", "manager", "source", "segment", "created", "integration", "tasks", "cava"]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="Nenhum candidato para exibir"
          description="Cadastre candidatos ou ajuste os filtros."
        />
      ) : (
        <>
          {/* Celular: abas por status + lista */}
          <div className="space-y-3 md:hidden">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Status">
              {columns.map((status) => {
                const active = status.id === mobileStatus;
                return (
                  <button
                    key={status.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMobileStatus(status.id)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm",
                      active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", statusDotClass(status.color))} aria-hidden />
                    {status.name}
                    <span className="tabular-nums text-muted-foreground">{byStatus.get(status.id)?.length ?? 0}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2" role="tabpanel">
              {(byStatus.get(mobileStatus) ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum candidato neste status.
                </p>
              ) : (
                byStatus.get(mobileStatus)!.map((candidate) => (
                  <KanbanCard
                    key={candidate.id}
                    candidate={candidate}
                    {...cardProps}
                    moveMenu={<MoveMenu candidate={candidate} statuses={options.statuses} onMove={move} />}
                  />
                ))
              )}
            </div>
          </div>

          {/* Desktop: colunas com arrastar e soltar */}
          <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <div className="hidden gap-3 overflow-x-auto pb-3 md:flex">
              {columns.map((status) => {
                const items = byStatus.get(status.id) ?? [];
                return (
                  <Column key={status.id} status={status} count={items.length}>
                    {items.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">Arraste candidatos para cá</p>
                    ) : (
                      items.map((candidate) => (
                        <DraggableCard key={candidate.id} candidate={candidate}>
                          <KanbanCard
                            candidate={candidate}
                            {...cardProps}
                            moveMenu={<MoveMenu candidate={candidate} statuses={options.statuses} onMove={move} />}
                          />
                        </DraggableCard>
                      ))
                    )}
                  </Column>
                );
              })}
            </div>
            <DragOverlay>
              {activeCandidate ? <KanbanCard candidate={activeCandidate} {...cardProps} dragging /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}
