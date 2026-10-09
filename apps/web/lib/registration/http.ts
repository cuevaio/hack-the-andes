import type { ApiFailure, ApiSuccess } from "@chofex/registration-contract";

import { publicRequestOrigin } from "../public-origin";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

const maximumBodyBytes = 65_536;

const requestIdFor = (request: Request): string => {
  const supplied = request.headers.get("x-request-id");
  if (supplied && /^[A-Za-z0-9_-]{1,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
};

export const jsonSuccess = <A>(
  requestId: string,
  data: A,
  status = 200,
): Response => {
  const body: ApiSuccess<A> = { version: 1, ok: true, requestId, data };
  return Response.json(body, { status, headers: responseHeaders });
};

const jsonFailure = (
  requestId: string,
  error: HttpError,
  request: Request,
): Response => {
  const body: ApiFailure = {
    version: 1,
    ok: false,
    requestId,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    },
  };
  const headers: Record<string, string> = { ...responseHeaders };
  if (error.status === 401) {
    const origin = publicRequestOrigin(request);
    headers["www-authenticate"] =
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  }
  return Response.json(body, {
    status: error.status,
    headers,
  });
};

export const withApiHandler = async (
  request: Request,
  handler: (requestId: string) => Promise<Response>,
): Promise<Response> => {
  const requestId = requestIdFor(request);
  try {
    return await handler(requestId);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonFailure(requestId, error, request);
    }
    console.error("Unhandled registration API error", { requestId, error });
    return jsonFailure(
      requestId,
      new HttpError(
        500,
        "INTERNAL_ERROR",
        "The registration service encountered an unexpected error",
        true,
      ),
      request,
    );
  }
};

export const readRequestBody = async (
  request: Request,
  timeoutMs = 10_000,
): Promise<string> => {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let contents = "";
  let bytesRead = 0;
  let stopReading: () => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    stopReading = () => {
      reject(
        new HttpError(
          408,
          "REQUEST_TIMEOUT",
          "Request body did not complete in time",
          true,
        ),
      );
      void reader.cancel().catch(() => undefined);
    };
  });
  const timeout = setTimeout(stopReading, timeoutMs);
  request.signal.addEventListener("abort", stopReading, { once: true });

  try {
    if (request.signal.aborted) stopReading();
    while (true) {
      const chunk = await Promise.race([interrupted, reader.read()]);
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maximumBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(
          413,
          "PAYLOAD_TOO_LARGE",
          "Request body exceeds 64 KiB",
        );
      }
      contents += decoder.decode(chunk.value, { stream: true });
    }
    return contents + decoder.decode();
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", stopReading);
    reader.releaseLock();
  }
};

export const readJson = async (request: Request): Promise<unknown> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maximumBodyBytes) {
    throw new HttpError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body exceeds 64 KiB",
    );
  }
  let contents: string;
  try {
    contents = await readRequestBody(request);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
};
