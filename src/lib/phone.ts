import { onlyDigits } from "@/lib/cpf";

/**
 * Normaliza telefone brasileiro para dígitos com DDI 55 (ex.: 5511999998888).
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888".
 * Retorna null se não for um número válido (DDD + 8 ou 9 dígitos).
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = onlyDigits(value);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d\d{8,9}$/.test(digits)) return null;
  // Celular tem 9 dígitos e começa com 9.
  const local = digits.slice(4);
  if (local.length === 9 && !local.startsWith("9")) return null;
  return digits;
}

/** 5511999998888 → (11) 99999-8888 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = onlyDigits(value);
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return value;
}

/** Link de discagem (tel:). */
export function telHref(value: string): string {
  return `tel:+${onlyDigits(value)}`;
}

/** Link do WhatsApp (sem integração: só abre a conversa). */
export function whatsappHref(value: string): string {
  return `https://wa.me/${onlyDigits(value)}`;
}
