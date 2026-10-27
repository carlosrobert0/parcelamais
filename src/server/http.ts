import { z } from "zod";
import { fieldErrors } from "@/domain/schemas";
import { errorSummary, logger } from "./logger";

const MAX_BODY_BYTES = 16_384;
const CONNECTION_ERROR_CODES = new Set(["57P01", "CONNECTION_CLOSED", "CONNECTION_DESTROYED", "CONNECTION_ENDED", "ECONNREFUSED"]);

type ParsedBody<T> = { data: T } | { response: Response };

export function isValidId(id: string): boolean {
  return z.uuid().safeParse(id).success;
}

export function notFound() {
  return Response.json({ error: "Pré-aprovação não encontrada" }, { status: 404 });
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<ParsedBody<z.output<T>>> {
  const text = await readLimitedText(request);
  if (text === null) return { response: Response.json({ error: "Requisição grande demais" }, { status: 413 }) };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { response: Response.json({ error: "O corpo da requisição não é um JSON válido" }, { status: 400 }) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) return { response: Response.json({ errors: fieldErrors(parsed.error) }, { status: 422 }) };
  return { data: parsed.data };
}

export function withErrorHandling<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const summary = errorSummary(error);
      logger.error(summary, "request failed");
      return CONNECTION_ERROR_CODES.has(summary.code ?? "")
        ? Response.json({ error: "Serviço temporariamente indisponível. Tente de novo." }, { status: 503 })
        : Response.json({ error: "Erro inesperado. Tente de novo." }, { status: 500 });
    }
  };
}

async function readLimitedText(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
