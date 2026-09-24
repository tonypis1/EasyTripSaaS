import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/server/errors/AppError";
import { logger } from "@/lib/observability";

export abstract class BaseController {
  protected ok<T>(data: T, status = 200, headers?: HeadersInit) {
    return NextResponse.json({ ok: true, data }, { status, headers });
  }

  protected fail(error: unknown, operation: string) {
    const appError = toAppError(error);

    /**
     * Un errore 4xx (validazione, dati non trovati, non autorizzato, ...) è
     * un input del chiamante, non un guasto applicativo: loggarlo a "error"
     * lo mischierebbe nell'alerting con i bug reali (5xx). Solo i 5xx sono
     * "error"; il resto è "warn".
     */
    const level = appError.statusCode >= 500 ? "error" : "warn";
    const message = `Controller failure in ${operation}`;
    if (level === "error") {
      logger.error(message, error, {
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
      });
    } else {
      logger.warn(message, {
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.message,
          details: appError.details,
        },
      },
      { status: appError.statusCode },
    );
  }
}

/** `schema.parse(body)` nei controller lancia un ZodError "nudo" (non un
 * AppError): senza questo mapping finiva nel branch generico 500
 * INTERNAL_ERROR, senza dettaglio sui campi e mischiato nei log/alerting
 * con i bug reali del server. */
function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      "Dati non validi",
      400,
      "VALIDATION_ERROR",
      error.flatten(),
    );
  }
  return new AppError("Errore interno del server", 500, "INTERNAL_ERROR");
}
