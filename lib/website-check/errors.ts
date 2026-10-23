export class WebsiteCheckError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "WebsiteCheckError";
  }
}

export function toPublicError(error: unknown) {
  if (error instanceof WebsiteCheckError) {
    return {
      status: error.status,
      body: { ok: false as const, error: { code: error.code, message: error.message } },
    };
  }

  console.error("Website check request failed", error instanceof WebsiteCheckError ? error.code : "UNEXPECTED_ERROR");
  return {
    status: 500,
    body: {
      ok: false as const,
      error: {
        code: "UNEXPECTED_ERROR",
        message: "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
      },
    },
  };
}
