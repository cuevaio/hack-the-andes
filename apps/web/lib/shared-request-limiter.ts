import { createHmac } from "node:crypto";

import {
  policyFor,
  requestClientAddress,
  requestRejection,
} from "./request-security";

type LimiterFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export const createSharedRequestLimiter =
  ({
    required = process.env.NODE_ENV === "production",
    configuration = () => ({
      url: process.env.RATE_LIMIT_SERVICE_URL,
      token: process.env.RATE_LIMIT_SERVICE_TOKEN,
    }),
    fetchImpl = fetch,
  }: {
    required?: boolean;
    configuration?: () => {
      url: string | undefined;
      token: string | undefined;
    };
    fetchImpl?: LimiterFetch;
  } = {}) =>
  async (request: Request): Promise<Response | undefined> => {
    const policy = policyFor(request);
    if (!policy) return;
    const { url, token } = configuration();
    if (!url || !token) {
      if (required) return requestRejection(request, 503, 5);
      return;
    }
    try {
      const endpoint = new URL(url);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.username ||
        endpoint.password ||
        endpoint.port ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.pathname !== "/"
      )
        throw new Error("Invalid shared limiter URL");
      const clientKey = createHmac("sha256", token)
        .update(requestClientAddress(request))
        .digest("hex");
      endpoint.pathname = `/consume/${policy.name}/${clientKey}`;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(1_500),
      });
      void response.body?.cancel().catch(() => undefined);
      if (response.status === 204) return;
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        if (!Number.isInteger(retryAfter) || retryAfter < 1 || retryAfter > 60)
          throw new Error("Invalid shared limiter response");
        return requestRejection(request, 429, retryAfter);
      }
      throw new Error("Shared limiter unavailable");
    } catch {
      return requestRejection(request, 503, 5);
    }
  };
