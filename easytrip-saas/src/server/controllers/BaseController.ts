import { NextResponse } from "next/server";
import { AppError } from "@/server/errors/AppError";
import { logger } from "@/lib/observability";

export abstract class BaseController {
  protected ok<T>(data: T, status = 200) {
    return NextResponse.json({ ok: true, data }, { status });
  }

  protected fail(error: unknown, operation: string) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError("Errore interno del server", 500, "INTERNAL_ERROR");

    logger.error(`Controller failure in ${operation}`, error, {
      code: appError.code,
      statusCode: appError.statusCode,
      details: appError.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.message,
        },
      },
      { status: appError.statusCode },
    );
  }
}
