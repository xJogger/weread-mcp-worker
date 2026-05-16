export class WeReadApiError extends Error {
  readonly status: number | undefined;
  readonly errcode: number | string | undefined;

  constructor(message: string, options: { status?: number; errcode?: number | string } = {}) {
    super(message);
    this.name = "WeReadApiError";
    this.status = options.status;
    this.errcode = options.errcode;
  }
}

export function sanitizeWeReadError(error: unknown): string {
  if (error instanceof WeReadApiError) return error.message;
  if (error instanceof Error) return error.message || "WeRead API request failed.";
  return "WeRead API request failed.";
}
