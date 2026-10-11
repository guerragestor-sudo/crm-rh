import { z } from "zod";

import { STATUS_COLORS } from "@/lib/status-colors";

export const LOOKUP_KINDS = ["regions", "segments", "sources"] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];

export const LOOKUP_LABELS: Record<LookupKind, { singular: string; plural: string; newLabel: string }> = {
  regions: { singular: "região", plural: "Regiões", newLabel: "Nova região" },
  segments: { singular: "ramo", plural: "Ramos", newLabel: "Novo ramo" },
  sources: { singular: "origem", plural: "Origens", newLabel: "Nova origem" },
};

const name = (max: number) =>
  z.string().trim().min(1, { error: "Informe o nome." }).max(max, { error: `Máximo de ${max} caracteres.` });

export const lookupSchema = z.object({
  id: z.uuid().optional(),
  name: name(80),
  is_active: z.boolean(),
});

export const statusSchema = z.object({
  id: z.uuid().optional(),
  name: name(60),
  color: z.enum(STATUS_COLORS),
  is_active: z.boolean(),
});

export const managerSchema = z.object({
  id: z.uuid().optional(),
  name: name(120),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email({ error: "E-mail inválido." }))]),
  is_active: z.boolean(),
});

export const organizationSettingsSchema = z.object({
  sla_target_days: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]),
});

export type LookupInput = z.infer<typeof lookupSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type ManagerInput = z.infer<typeof managerSchema>;
