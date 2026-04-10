type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
};

function emit(level: LogLevel, payload: LogPayload) {
  const event = {
    level,
    timestamp: new Date().toISOString(),
    message: payload.message,
    context: payload.context ?? {},
    error:
      payload.error instanceof Error
        ? {
            name: payload.error.name,
            message: payload.error.message,
            stack: payload.error.stack,
          }
        : payload.error,
  };

  if (level === "error") {
    console.error(JSON.stringify(event));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(event));
    return;
  }

  console.info(JSON.stringify(event));
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    emit("info", { message, context }),
  warn: (message: string, context?: Record<string, unknown>) =>
    emit("warn", { message, context }),
  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => emit("error", { message, error, context }),
};
