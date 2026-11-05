import { z } from "zod";

import { AVAILABILITY_OPTIONS, COURSE_OPTIONS, DOCUMENTATION_OPTIONS } from "@/modules/candidates/labels";

import { MAX_IMPORT_ROWS } from "./parse";

/**
 * Linha pronta para gravar, montada na prévia (navegador) e validada de novo no
 * servidor. Cadastros de apoio vêm como id existente ou nome a criar.
 */
const refValue = z.union([z.object({ id: z.uuid() }), z.object({ new: z.string().trim().min(1).max(120) })]).nullable();
const isoDate = z.iso.date().nullable();
const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const importRowSchema = z.object({
  line: z.number().int().min(1).max(1_000_000),
  full_name: z.string().trim().min(2).max(150),
  phone: z.string().regex(/^\d{12,13}$/).nullable(),
  email: z.string().max(200).regex(EMAIL_PATTERN).nullable(),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  status_id: z.uuid(),
  manager: refValue,
  region: refValue,
  source: refValue,
  segment: refValue,
  availability: z.enum(values(AVAILABILITY_OPTIONS)).nullable(),
  currently_working: z.boolean().nullable(),
  interview_date: isoDate,
  interview_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  integration_date: isoDate,
  integration_planned_date: isoDate,
  created_date: isoDate,
  documentation_status: z.enum(values(DOCUMENTATION_OPTIONS)),
  documentation_notes: z.string().max(2000).nullable(),
  course_status: z.enum(values(COURSE_OPTIONS)),
  course_notes: z.string().max(2000).nullable(),
  cavaplay: z.boolean(),
  course_paid_by_cava: z.boolean(),
  notes: z.string().max(5000).nullable(),
});

export type ImportRow = z.infer<typeof importRowSchema>;
export type RefValue = z.infer<typeof refValue>;

export const importPayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  rows: z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;

export const contactsCheckSchema = z.object({
  phones: z.array(z.string().regex(/^\d{12,13}$/)).max(MAX_IMPORT_ROWS),
  cpfs: z.array(z.string().regex(/^\d{11}$/)).max(MAX_IMPORT_ROWS),
});

export type ExistingContact = { id: string; name: string; archived: boolean };
export type ExistingContacts = { phones: Record<string, ExistingContact>; cpfs: Record<string, ExistingContact> };
