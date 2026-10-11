import "server-only";

import { logger } from "@/server/logger";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "UNEXPECTED";

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  details?: Record<string, string>;
};

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

type DatabaseError = { code?: string; message?: string };

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  NOT_FOUND: "Registro não encontrado.",
  VALIDATION: "Verifique os dados informados.",
  CONFLICT: "Já existe um registro com esses dados.",
  UNEXPECTED: "Não foi possível concluir a operação. Tente novamente.",
};

/**
 * Converte erro do Postgres/PostgREST em erro de domínio. As mensagens de
 * regras do banco (23514, 22023, P0002) já são escritas para o usuário.
 */
export function fromDatabaseError(error: DatabaseError, context: Record<string, string> = {}): AppError {
  switch (error.code) {
    case "23505":
      return new AppError("CONFLICT", DEFAULT_MESSAGES.CONFLICT);
    case "42501":
      return new AppError("FORBIDDEN", DEFAULT_MESSAGES.FORBIDDEN);
    case "P0002":
    case "PGRST116":
      return new AppError("NOT_FOUND", error.message || DEFAULT_MESSAGES.NOT_FOUND);
    case "23514":
    case "22023":
      return new AppError("VALIDATION", error.message || DEFAULT_MESSAGES.VALIDATION);
    case "23503":
      return new AppError("VALIDATION", "Referência inválida.");
    default:
      logger.error("database_error", { code: error.code ?? "unknown", ...context });
      return new AppError("UNEXPECTED", DEFAULT_MESSAGES.UNEXPECTED);
  }
}

/** Fronteira das Server Actions: nunca deixa vazar erro interno para o cliente. */
export function toActionError(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message || DEFAULT_MESSAGES[error.code],
        fieldErrors: error.fieldErrors,
        details: error.details,
      },
    };
  }
  logger.error("unexpected_error", { message: error instanceof Error ? error.name : "unknown" });
  return { ok: false, error: { code: "UNEXPECTED", message: DEFAULT_MESSAGES.UNEXPECTED } };
}
