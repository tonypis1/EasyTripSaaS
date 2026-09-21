import { AppError } from "@/server/errors/AppError";

/**
 * `req.json()` lancia un `SyntaxError` "nudo" su body malformato: ogni
 * controller lo intercettava a mano per mapparlo su 400 INVALID_JSON,
 * altrimenti finiva nel 500 INTERNAL_ERROR generico di `BaseController.fail`.
 * Centralizzando qui il parsing, i controller possono limitarsi a un unico
 * `catch` che passa già a `this.fail(error, ...)`.
 */
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("Body JSON non valido", 400, "INVALID_JSON");
  }
}

/** Come `parseJsonBody`, ma tratta un body assente/vuoto come `{}` invece che come errore. */
export async function parseOptionalJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Body JSON non valido", 400, "INVALID_JSON");
  }
}
