import pino from "pino";

export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export function errorSummary(error: unknown): { name?: string; code?: string } {
  const source = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (!(source instanceof Error)) return {};
  return { name: source.name, code: (source as Error & { code?: string }).code };
}
