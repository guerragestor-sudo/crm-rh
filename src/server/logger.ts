import "server-only";

type Level = "info" | "warn" | "error";
type Context = Record<string, string | number | boolean | null | undefined>;

/**
 * Log estruturado em JSON (uma linha por evento). Nunca registrar dados
 * pessoais (nome, CPF, telefone, e-mail): somente ids e códigos.
 */
function write(level: Level, event: string, context: Context = {}) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...context });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, context?: Context) => write("info", event, context),
  warn: (event: string, context?: Context) => write("warn", event, context),
  error: (event: string, context?: Context) => write("error", event, context),
};
