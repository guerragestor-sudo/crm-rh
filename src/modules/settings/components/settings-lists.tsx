"use client";

import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { FormField, inputClass } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/phone";
import { STATUS_COLORS, statusDotClass, type StatusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { ManagerOption, Option, StatusOption } from "@/modules/candidates/types";
import type { ActionResult } from "@/server/errors";

import {
  saveLookupAction,
  saveManagerAction,
  saveOrganizationSettingsAction,
  saveStatusAction,
  swapStatusesAction,
} from "../actions";
import { LOOKUP_LABELS, type LookupKind } from "../schema";

function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  function save(run: () => Promise<ActionResult>, onDone: () => void, success = "Salvo.") {
    startTransition(async () => {
      const response = await run();
      if (!response.ok) {
        setErrors(response.error.fieldErrors ?? {});
        toast.error(response.error.message);
        return;
      }
      setErrors({});
      toast.success(success);
      onDone();
      router.refresh();
    });
  }

  return { pending, errors, setErrors, save };
}

function Row({ children, inactive }: { children: ReactNode; inactive?: boolean }) {
  return (
    <li className={cn("flex min-h-14 items-center gap-3 px-4 py-2", inactive && "opacity-60")}>{children}</li>
  );
}

function InactiveBadge() {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inativo</span>;
}

function ActiveCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="item-active" checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor="item-active" className="font-normal">
        Ativo (aparece nos formulários e filtros)
      </Label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Listas simples: regiões, ramos, origens                              */
/* ------------------------------------------------------------------ */

export function LookupList({ kind, items }: { kind: LookupKind; items: Option[] }) {
  const labels = LOOKUP_LABELS[kind];
  const { pending, errors, setErrors, save } = useSave();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Option | null>(null);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save(() => saveLookupAction(kind, { name: newName, is_active: true }), () => setNewName(""), "Adicionado.");
        }}
      >
        <Input
          aria-label={`Nova ${labels.singular}`}
          placeholder={`Adicionar ${labels.singular}`}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          className={inputClass}
          maxLength={80}
        />
        <Button type="submit" className="h-11 md:h-10" disabled={pending || !newName.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Adicionar
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum item cadastrado.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item) => (
            <Row key={item.id} inactive={!item.is_active}>
              <span className="flex-1 truncate text-sm">{item.name}</span>
              {!item.is_active ? <InactiveBadge /> : null}
              <Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`} onClick={() => setEditing(item)}>
                <Pencil aria-hidden />
              </Button>
            </Row>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && (setEditing(null), setErrors({}))}>
        {editing ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar {labels.singular}</DialogTitle>
              <DialogDescription>Itens inativos continuam nos registros antigos.</DialogDescription>
            </DialogHeader>
            <FormField id="lookup-name" label="Nome" error={errors.name?.[0]}>
              <Input
                id="lookup-name"
                value={editing.name}
                maxLength={80}
                className={inputClass}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </FormField>
            <ActiveCheckbox checked={editing.is_active} onChange={(value) => setEditing({ ...editing, is_active: value })} />
            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                className="h-11"
                disabled={pending}
                onClick={() => save(() => saveLookupAction(kind, editing), () => setEditing(null))}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status operacionais                                                  */
/* ------------------------------------------------------------------ */

type StatusDraft = { id?: string; name: string; color: StatusColor; is_active: boolean };

export function StatusList({ items }: { items: StatusOption[] }) {
  const { pending, errors, setErrors, save } = useSave();
  const [editing, setEditing] = useState<StatusDraft | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="h-11 md:h-10" onClick={() => setEditing({ name: "", color: "slate", is_active: true })}>
          <Plus aria-hidden />
          Novo status
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((item, index) => (
          <Row key={item.id} inactive={!item.is_active}>
            <span className={cn("size-3 shrink-0 rounded-full", statusDotClass(item.color))} aria-hidden />
            <span className="flex-1 truncate text-sm">{item.name}</span>
            {!item.is_active ? <InactiveBadge /> : null}
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Subir ${item.name}`}
                disabled={pending || index === 0}
                onClick={() => save(() => swapStatusesAction(item.id, items[index - 1].id), () => {}, "Ordem atualizada.")}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Descer ${item.name}`}
                disabled={pending || index === items.length - 1}
                onClick={() => save(() => swapStatusesAction(item.id, items[index + 1].id), () => {}, "Ordem atualizada.")}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${item.name}`}
                onClick={() =>
                  setEditing({ id: item.id, name: item.name, color: item.color as StatusColor, is_active: item.is_active })
                }
              >
                <Pencil aria-hidden />
              </Button>
            </div>
          </Row>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A ordem define as colunas do Kanban. Status não são excluídos: desative para deixar de usar.
      </p>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && (setEditing(null), setErrors({}))}>
        {editing ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar status" : "Novo status"}</DialogTitle>
              <DialogDescription>Status são situações operacionais; não alteram regras do sistema.</DialogDescription>
            </DialogHeader>
            <FormField id="status-name" label="Nome" error={errors.name?.[0]}>
              <Input
                id="status-name"
                value={editing.name}
                maxLength={60}
                className={inputClass}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </FormField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Cor</legend>
              <div className="flex flex-wrap gap-2">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={editing.color === color}
                    onClick={() => setEditing({ ...editing, color })}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border",
                      editing.color === color && "ring-2 ring-primary ring-offset-2",
                    )}
                  >
                    <span className={cn("size-5 rounded-full", statusDotClass(color))} />
                  </button>
                ))}
              </div>
            </fieldset>
            <ActiveCheckbox checked={editing.is_active} onChange={(value) => setEditing({ ...editing, is_active: value })} />
            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                className="h-11"
                disabled={pending}
                onClick={() => save(() => saveStatusAction(editing), () => setEditing(null))}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gerentes                                                             */
/* ------------------------------------------------------------------ */

type ManagerDraft = { id?: string; name: string; phone: string; email: string; is_active: boolean };

export function ManagerList({ items }: { items: ManagerOption[] }) {
  const { pending, errors, setErrors, save } = useSave();
  const [editing, setEditing] = useState<ManagerDraft | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="h-11 md:h-10" onClick={() => setEditing({ name: "", phone: "", email: "", is_active: true })}>
          <Plus aria-hidden />
          Novo gerente
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum gerente cadastrado.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item) => (
            <Row key={item.id} inactive={!item.is_active}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.phone ? formatPhone(item.phone) : null, item.email].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </div>
              {!item.is_active ? <InactiveBadge /> : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${item.name}`}
                onClick={() =>
                  setEditing({
                    id: item.id,
                    name: item.name,
                    phone: item.phone ? formatPhone(item.phone) : "",
                    email: item.email ?? "",
                    is_active: item.is_active,
                  })
                }
              >
                <Pencil aria-hidden />
              </Button>
            </Row>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && (setEditing(null), setErrors({}))}>
        {editing ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar gerente" : "Novo gerente"}</DialogTitle>
              <DialogDescription>Gerente para quem os candidatos são direcionados (sem acesso ao sistema).</DialogDescription>
            </DialogHeader>
            <FormField id="manager-name" label="Nome" error={errors.name?.[0]}>
              <Input
                id="manager-name"
                value={editing.name}
                maxLength={120}
                className={inputClass}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </FormField>
            <FormField id="manager-phone" label="Telefone" error={errors.phone?.[0]}>
              <Input
                id="manager-phone"
                type="tel"
                inputMode="tel"
                value={editing.phone}
                className={inputClass}
                onChange={(event) => setEditing({ ...editing, phone: event.target.value })}
              />
            </FormField>
            <FormField id="manager-email" label="E-mail" error={errors.email?.[0]}>
              <Input
                id="manager-email"
                type="email"
                value={editing.email}
                className={inputClass}
                onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              />
            </FormField>
            <ActiveCheckbox checked={editing.is_active} onChange={(value) => setEditing({ ...editing, is_active: value })} />
            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                className="h-11"
                disabled={pending}
                onClick={() => save(() => saveManagerAction(editing), () => setEditing(null))}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meta de SLA (opcional)                                               */
/* ------------------------------------------------------------------ */

export function SlaTargetForm({ value }: { value: number | null }) {
  const { pending, errors, save } = useSave();
  const [target, setTarget] = useState(value === null ? "" : String(value));

  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save(() => saveOrganizationSettingsAction({ sla_target_days: target }), () => {});
      }}
    >
      <FormField
        id="sla-target"
        label="Meta de SLA (dias) — opcional"
        error={errors.sla_target_days?.[0]}
        hint="Quando definida, o sistema destaca candidatos acima da meta. Deixe em branco para não usar meta."
      >
        <Input
          id="sla-target"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className={cn(inputClass, "max-w-40")}
        />
      </FormField>
      <Button type="submit" className="h-11 md:h-10" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
