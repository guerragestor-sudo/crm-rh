import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um e-mail válido." })),
  password: z.string().min(1, { error: "Informe a senha." }).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Aceita apenas caminhos internos (evita redirecionamento aberto). */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}
