"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { statusDotClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

import { countActiveFilters, type CandidateFilters } from "../filters";
import type { CandidateOptions } from "../types";

type ListKey = "status_ids" | "region_ids" | "source_ids" | "manager_ids" | "segment_ids";

export type FilterField =
  | "status"
  | "region"
  | "source"
  | "manager"
  | "segment"
  | "created"
  | "integration"
  | "integration_period"
  | "tasks"
  | "archived";

const DEFAULT_FIELDS: FilterField[] = [
  "status",
  "region",
  "manager",
  "source",
  "segment",
  "created",
  "integration",
  "tasks",
];

function ChipGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: { id: string; name: string; color?: string; is_active: boolean }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const visible = items.filter((item) => item.is_active || selected.includes(item.id));
  if (visible.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(item.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {item.color ? (
                <span className={cn("size-2 rounded-full", statusDotClass(item.color))} aria-hidden />
              ) : null}
              {item.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors",
        active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Painel de filtros combinados (E). Reutilizado por lista, Kanban, dashboard, SLA e relatórios. */
export function FilterSheet({
  value,
  onApply,
  options,
  fields = DEFAULT_FIELDS,
  triggerClassName,
}: {
  value: CandidateFilters;
  onApply: (filters: CandidateFilters) => void;
  options: Pick<CandidateOptions, "statuses" | "regions" | "sources" | "managers" | "segments">;
  fields?: FilterField[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CandidateFilters>(value);
  const active = countActiveFilters(value);
  const has = (field: FilterField) => fields.includes(field);

  function toggle(key: ListKey, id: string) {
    setDraft((current) => {
      const list = current[key] ?? [];
      const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
      return { ...current, [key]: next.length ? next : undefined };
    });
  }

  function setField<K extends keyof CandidateFilters>(key: K, fieldValue: CandidateFilters[K]) {
    setDraft((current) => ({ ...current, [key]: fieldValue || undefined }));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("h-11 gap-2 md:h-10", triggerClassName)}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {active > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {active}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Os resultados atendem a todos os critérios selecionados.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {has("status") ? (
            <ChipGroup
              label="Status"
              items={options.statuses}
              selected={draft.status_ids ?? []}
              onToggle={(id) => toggle("status_ids", id)}
            />
          ) : null}
          {has("region") ? (
            <ChipGroup
              label="Região"
              items={options.regions}
              selected={draft.region_ids ?? []}
              onToggle={(id) => toggle("region_ids", id)}
            />
          ) : null}
          {has("manager") ? (
            <ChipGroup
              label="Gerente"
              items={options.managers}
              selected={draft.manager_ids ?? []}
              onToggle={(id) => toggle("manager_ids", id)}
            />
          ) : null}
          {has("source") ? (
            <ChipGroup
              label="Origem"
              items={options.sources}
              selected={draft.source_ids ?? []}
              onToggle={(id) => toggle("source_ids", id)}
            />
          ) : null}
          {has("segment") ? (
            <ChipGroup
              label="Ramo"
              items={options.segments}
              selected={draft.segment_ids ?? []}
              onToggle={(id) => toggle("segment_ids", id)}
            />
          ) : null}
          {has("created") ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Período de cadastro</legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filter-created-from" className="text-xs text-muted-foreground">
                    De
                  </Label>
                  <Input
                    id="filter-created-from"
                    type="date"
                    className="h-11"
                    value={draft.created_from ?? ""}
                    onChange={(event) => setField("created_from", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filter-created-to" className="text-xs text-muted-foreground">
                    Até
                  </Label>
                  <Input
                    id="filter-created-to"
                    type="date"
                    className="h-11"
                    value={draft.created_to ?? ""}
                    onChange={(event) => setField("created_to", event.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          ) : null}
          {has("integration_period") ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Período de integração</legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filter-integration-from" className="text-xs text-muted-foreground">
                    De
                  </Label>
                  <Input
                    id="filter-integration-from"
                    type="date"
                    className="h-11"
                    value={draft.integration_from ?? ""}
                    onChange={(event) => setField("integration_from", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filter-integration-to" className="text-xs text-muted-foreground">
                    Até
                  </Label>
                  <Input
                    id="filter-integration-to"
                    type="date"
                    className="h-11"
                    value={draft.integration_to ?? ""}
                    onChange={(event) => setField("integration_to", event.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          ) : null}
          {has("integration") ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Integração</legend>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  active={draft.integration === "pending"}
                  onClick={() => setField("integration", draft.integration === "pending" ? undefined : "pending")}
                >
                  Aguardando integração
                </ToggleChip>
                <ToggleChip
                  active={draft.integration === "done"}
                  onClick={() => setField("integration", draft.integration === "done" ? undefined : "done")}
                >
                  Integrados
                </ToggleChip>
              </div>
            </fieldset>
          ) : null}
          {has("tasks") ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Acompanhamento</legend>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  active={Boolean(draft.has_overdue_task)}
                  onClick={() => setField("has_overdue_task", !draft.has_overdue_task || undefined)}
                >
                  Com tarefa atrasada
                </ToggleChip>
                <ToggleChip
                  active={Boolean(draft.no_next_action)}
                  onClick={() => setField("no_next_action", !draft.no_next_action || undefined)}
                >
                  Sem próxima ação
                </ToggleChip>
              </div>
            </fieldset>
          ) : null}
          {has("archived") ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Situação</legend>
              <ToggleChip
                active={Boolean(draft.archived)}
                onClick={() => setField("archived", !draft.archived || undefined)}
              >
                Mostrar somente arquivados
              </ToggleChip>
            </fieldset>
          ) : null}
        </div>
        <SheetFooter className="flex-row gap-2 border-t">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => {
              const cleared: CandidateFilters = {};
              setDraft(cleared);
              onApply(cleared);
              setOpen(false);
            }}
          >
            Limpar
          </Button>
          <Button
            className="h-11 flex-1"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
