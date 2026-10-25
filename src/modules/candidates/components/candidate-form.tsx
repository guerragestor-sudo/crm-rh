"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { FormField, inputClass } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { checkDuplicatesAction, createCandidateAction, updateCandidateAction } from "../actions";
import { AVAILABILITY_OPTIONS, COURSE_OPTIONS, DOCUMENTATION_OPTIONS } from "../labels";
import { candidateFormSchema, FORM_STEPS, type CandidateFormValues } from "../schema";
import type { CandidateOptions, DuplicateMatch, Option } from "../types";
import { DuplicateAlert } from "./duplicate-alert";

const WORKING_OPTIONS = [
  { value: "", label: "Não informado" },
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const;

const YES_NO_OPTIONS = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim" },
] as const;

/** Campos sim/não da Cava (etapa "Cadastro e curso"). */
const CAVA_FIELDS = [
  { name: "cavaplay", label: "Cavaplay?" },
  { name: "course_paid_by_cava", label: "Curso pago pela Cava?" },
] as const;

function selectable<T extends Option>(items: T[], current: string) {
  return items.filter((item) => item.is_active || item.id === current);
}

type Props = {
  mode: "create" | "edit";
  candidateId?: string;
  defaultValues: CandidateFormValues;
  options: CandidateOptions;
  today: string;
};

export function CandidateForm({ mode, candidateId, defaultValues, options, today }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [submitting, startSubmit] = useTransition();
  const [saveAndNew, setSaveAndNew] = useState(false);

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = form;

  const statusId = useWatch({ control, name: "status_id" });
  const managerId = useWatch({ control, name: "manager_id" });
  const statusChanged = mode === "edit" && statusId !== defaultValues.status_id;
  const managerChanged = mode === "edit" && managerId !== defaultValues.manager_id;
  const lastStep = FORM_STEPS.length - 1;

  async function checkDuplicates() {
    const { cpf, phone, email } = form.getValues();
    const response = await checkDuplicatesAction({ cpf, phone, email, excludeId: candidateId });
    if (response.ok) setDuplicates(response.data);
  }

  /** register + defaultValue: o HTML do servidor já sai com os valores (sem "piscar" vazio antes do JS). */
  function reg(name: keyof CandidateFormValues, options?: Parameters<typeof register>[1]) {
    return { ...register(name, options), defaultValue: defaultValues[name] };
  }

  function fieldError(name: keyof CandidateFormValues) {
    return errors[name]?.message;
  }

  function ariaFor(name: keyof CandidateFormValues) {
    return {
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }

  async function next() {
    const valid = await trigger([...FORM_STEPS[step].fields]);
    if (valid) {
      setStep((current) => Math.min(current + 1, lastStep));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function onInvalid(fieldErrors: FieldErrors<CandidateFormValues>) {
    const firstStep = FORM_STEPS.findIndex((item) =>
      item.fields.some((field) => field in fieldErrors),
    );
    if (firstStep >= 0) setStep(firstStep);
    toast.error("Verifique os campos destacados.");
  }

  function onSubmit(values: CandidateFormValues) {
    startSubmit(async () => {
      const response =
        mode === "create"
          ? await createCandidateAction(values)
          : await updateCandidateAction(candidateId!, values);

      if (!response.ok) {
        const { fieldErrors, message } = response.error;
        if (fieldErrors) {
          for (const [field, messages] of Object.entries(fieldErrors)) {
            if (messages?.[0]) setError(field as keyof CandidateFormValues, { message: messages[0] });
          }
          const firstStep = FORM_STEPS.findIndex((item) =>
            item.fields.some((field) => field in fieldErrors),
          );
          if (firstStep >= 0) setStep(firstStep);
        }
        toast.error(message);
        return;
      }

      if (mode === "create") {
        const createdId = (response.data as { id: string }).id;
        toast.success("Candidato cadastrado.", {
          action: saveAndNew ? { label: "Abrir", onClick: () => router.push(`/candidatos/${createdId}`) } : undefined,
        });
        if (saveAndNew) {
          reset({ ...defaultValues });
          setDuplicates([]);
          setStep(0);
          window.scrollTo({ top: 0 });
        } else {
          router.push(`/candidatos/${createdId}`);
        }
      } else {
        toast.success("Alterações salvas.");
        router.push(`/candidatos/${candidateId}`);
        router.refresh();
      }
    });
  }

  const stepClass = (index: number) => cn("space-y-4", index !== step && "hidden", "md:block");

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      {/* Indicador de etapas (celular) */}
      <ol className="flex gap-1.5 md:hidden" aria-label="Etapas do cadastro">
        {FORM_STEPS.map((item, index) => (
          <li key={item.title} className="flex-1">
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              className={cn("h-1.5 w-full rounded-full", index <= step ? "bg-primary" : "bg-muted")}
              aria-label={`${index + 1}. ${item.title}`}
              aria-current={index === step ? "step" : undefined}
            />
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium text-muted-foreground md:hidden">
        Etapa {step + 1} de {FORM_STEPS.length} · {FORM_STEPS[step].title}
      </p>

      {/* 1. Dados pessoais */}
      <section className={stepClass(0)} aria-labelledby="step-personal">
        <h2 id="step-personal" className="hidden text-base font-semibold md:block">
          Dados pessoais
        </h2>
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs md:grid-cols-2 md:p-5">
          <FormField id="full_name" label="Nome completo" required error={fieldError("full_name")} className="md:col-span-2">
            <Input id="full_name" autoComplete="off" className={inputClass} {...reg("full_name")} {...ariaFor("full_name")} />
          </FormField>
          <FormField id="phone" label="Telefone / WhatsApp" error={fieldError("phone")} hint="Com DDD. Se ainda não tiver, deixe em branco: a ficha fica com telefone pendente.">
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(11) 98888-7777"
              className={inputClass}
              {...reg("phone", {
                onBlur: (event) => {
                  const normalized = normalizePhone(event.target.value);
                  if (normalized) setValue("phone", formatPhone(normalized));
                  void checkDuplicates();
                },
              })}
              {...ariaFor("phone")}
            />
          </FormField>
          <FormField id="email" label="E-mail" error={fieldError("email")}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              className={inputClass}
              {...reg("email", { onBlur: () => void checkDuplicates() })}
              {...ariaFor("email")}
            />
          </FormField>
          <FormField id="cpf" label="CPF" error={fieldError("cpf")}>
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              className={inputClass}
              {...reg("cpf", {
                onBlur: (event) => {
                  if (isValidCpf(event.target.value)) setValue("cpf", formatCpf(event.target.value));
                  void checkDuplicates();
                },
              })}
              {...ariaFor("cpf")}
            />
          </FormField>
          <div className="md:col-span-2">
            <DuplicateAlert matches={duplicates} />
          </div>
        </div>
      </section>

      {/* 2. Perfil */}
      <section className={stepClass(1)} aria-labelledby="step-profile">
        <h2 id="step-profile" className="hidden text-base font-semibold md:block">
          Perfil
        </h2>
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs md:grid-cols-2 md:p-5">
          <FormField id="region_id" label="Região" error={fieldError("region_id")}>
            <NativeSelect id="region_id" {...reg("region_id")}>
              <option value="">Não informada</option>
              {selectable(options.regions, defaultValues.region_id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="segment_id" label="Ramo" error={fieldError("segment_id")}>
            <NativeSelect id="segment_id" {...reg("segment_id")}>
              <option value="">Não informado</option>
              {selectable(options.segments, defaultValues.segment_id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="availability" label="Disponibilidade" error={fieldError("availability")}>
            <NativeSelect id="availability" {...reg("availability")}>
              <option value="">Não informada</option>
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="source_id" label="Origem / captação" error={fieldError("source_id")}>
            <NativeSelect id="source_id" {...reg("source_id")}>
              <option value="">Não informada</option>
              {selectable(options.sources, defaultValues.source_id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-medium" id="currently_working-label">
              Trabalha atualmente?
            </span>
            <Controller
              control={control}
              name="currently_working"
              render={({ field }) => (
                <Segmented
                  name="currently_working"
                  ariaLabel="Trabalha atualmente?"
                  value={field.value}
                  onChange={field.onChange}
                  options={WORKING_OPTIONS}
                />
              )}
            />
          </div>
        </div>
      </section>

      {/* 3. Processo */}
      <section className={stepClass(2)} aria-labelledby="step-process">
        <h2 id="step-process" className="hidden text-base font-semibold md:block">
          Processo
        </h2>
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs md:grid-cols-2 md:p-5">
          <FormField id="status_id" label="Status" required error={fieldError("status_id")}>
            <NativeSelect id="status_id" {...reg("status_id")} {...ariaFor("status_id")}>
              <option value="" disabled>
                Selecione
              </option>
              {options.statuses
                .filter((item) => item.is_active || item.id === defaultValues.status_id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id="manager_id" label="Gerente de indicação / destino" error={fieldError("manager_id")}>
            <NativeSelect id="manager_id" {...reg("manager_id")}>
              <option value="">Sem gerente</option>
              {selectable(options.managers, defaultValues.manager_id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {statusChanged ? (
            <FormField
              id="status_reason"
              label="Motivo da mudança de status (opcional)"
              error={fieldError("status_reason")}
              className="md:col-span-2"
            >
              <Input id="status_reason" className={inputClass} {...reg("status_reason")} />
            </FormField>
          ) : null}
          {managerChanged ? (
            <FormField
              id="manager_reason"
              label="Motivo da troca de gerente (opcional)"
              error={fieldError("manager_reason")}
              className="md:col-span-2"
            >
              <Input id="manager_reason" className={inputClass} {...reg("manager_reason")} />
            </FormField>
          ) : null}
          <FormField id="interview_at" label="Data da entrevista" error={fieldError("interview_at")}>
            <Input id="interview_at" type="datetime-local" className={inputClass} {...reg("interview_at")} {...ariaFor("interview_at")} />
          </FormField>
          <FormField
            id="integration_date"
            label="Data de integração"
            error={fieldError("integration_date")}
            hint="Ao preencher, o SLA do candidato é congelado."
          >
            <Input
              id="integration_date"
              type="date"
              max={today}
              className={inputClass}
              {...reg("integration_date")}
              {...ariaFor("integration_date")}
            />
          </FormField>
          <FormField id="notes" label="Observação" error={fieldError("notes")} className="md:col-span-2">
            <Textarea id="notes" rows={4} className="text-base md:text-sm" {...reg("notes")} {...ariaFor("notes")} />
          </FormField>
        </div>
      </section>

      {/* 4. Cadastro/documentação e curso */}
      <section className={stepClass(3)} aria-labelledby="step-docs">
        <h2 id="step-docs" className="hidden text-base font-semibold md:block">
          Cadastro, documentação e curso
        </h2>
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs md:grid-cols-2 md:p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Cadastro / documentação</span>
            <Controller
              control={control}
              name="documentation_status"
              render={({ field }) => (
                <Segmented
                  name="documentation_status"
                  ariaLabel="Cadastro / documentação"
                  value={field.value}
                  onChange={field.onChange}
                  options={DOCUMENTATION_OPTIONS}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Curso</span>
            <Controller
              control={control}
              name="course_status"
              render={({ field }) => (
                <Segmented
                  name="course_status"
                  ariaLabel="Curso"
                  value={field.value}
                  onChange={field.onChange}
                  options={COURSE_OPTIONS}
                />
              )}
            />
          </div>
          <FormField id="documentation_notes" label="Informações de cadastro / documentação" error={fieldError("documentation_notes")}>
            <Textarea id="documentation_notes" rows={3} className="text-base md:text-sm" {...reg("documentation_notes")} />
          </FormField>
          <FormField id="course_notes" label="Informações do curso" error={fieldError("course_notes")}>
            <Textarea id="course_notes" rows={3} className="text-base md:text-sm" {...reg("course_notes")} />
          </FormField>
          {CAVA_FIELDS.map((cava) => (
            <div key={cava.name} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{cava.label}</span>
              <Controller
                control={control}
                name={cava.name}
                render={({ field }) => (
                  <Segmented
                    name={cava.name}
                    ariaLabel={cava.label}
                    value={field.value}
                    onChange={field.onChange}
                    options={YES_NO_OPTIONS}
                  />
                )}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Ações — celular: navegação por etapas */}
      <div className="sticky bottom-20 z-10 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        {step > 0 ? (
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden />
            Voltar
          </Button>
        ) : null}
        {step < lastStep ? (
          <>
            {mode === "create" && step >= 0 ? (
              <Button type="submit" variant="outline" className="h-12 flex-1" disabled={submitting} onClick={() => setSaveAndNew(false)}>
                Salvar
              </Button>
            ) : null}
            <Button type="button" className="h-12 flex-1" onClick={next}>
              Avançar
              <ArrowRight aria-hidden />
            </Button>
          </>
        ) : (
          <Button type="submit" className="h-12 flex-1" disabled={submitting} onClick={() => setSaveAndNew(false)}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {mode === "create" ? "Cadastrar" : "Salvar alterações"}
          </Button>
        )}
      </div>

      {/* Ações — desktop */}
      <div className="hidden justify-end gap-2 md:flex">
        <Button type="button" variant="ghost" className="h-10" onClick={() => router.back()}>
          Cancelar
        </Button>
        {mode === "create" ? (
          <Button type="submit" variant="outline" className="h-10" disabled={submitting} onClick={() => setSaveAndNew(true)}>
            Salvar e cadastrar outro
          </Button>
        ) : null}
        <Button type="submit" className="h-10" disabled={submitting} onClick={() => setSaveAndNew(false)}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "create" ? "Cadastrar candidato" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
