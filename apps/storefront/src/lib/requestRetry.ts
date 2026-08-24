export class HttpRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
  }
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function shouldRetryRequestError(error: unknown): boolean {
  if (!(error instanceof HttpRequestError)) return true;
  return isRetryableHttpStatus(error.status);
}
