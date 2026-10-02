import { afterEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
  authenticationRecoveryMessage,
  beginPictureUpload,
  completePictureUpload,
  evaluateChallenge,
  getBadge,
  getCurrentUser,
  getRegistration,
  regenerateBadge,
} from "../src/api-client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const registrationResult = {
  registration: {
    id: "registration-123",
    status: "submitted",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    participationMode: "in_person",
    shippedProject: "An analytical engine simulator.",
    hackathonProject: "A collaborative programming environment.",
    nationalIdProvided: false,
    mediaConsent: false,
    codeOfConductAccepted: true,
    privacyPolicyAccepted: true,
    submittedAt: "2026-09-09T00:00:00.000Z",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    challenges: [],
  },
  requirements: {
    stage: "review",
    canSubmitNewApplication: false,
    canSubmitAcceptedDetails: false,
    canSaveDraft: false,
    canSubmitApplication: false,
    parts: [],
    missing: [],
  },
} as const;

describe("registration API client", () => {
  test("Slow Service waits through cold evaluation while Scheduler keeps its existing timeout", async () => {
    const originalTimeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    const requests: string[] = [];
    AbortSignal.timeout = (ms: number) => {
      timeouts.push(ms);
      return originalTimeout(ms);
    };
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-evaluation",
        data: {
          accuracy: 0.85,
          exactCount: 85,
          sampleSize: 100,
          meanError: 15,
          queriesUsed: 0,
          runtimeMs: 100,
          shareCode: "LEDGER",
          evaluationsUsed: 1,
          evaluationsRemaining: 4,
          evaluationsLimit: 5,
          rankingPath: "/challenges/make-it-fast",
          shareText: "85/100",
        },
      });
    };
    try {
      const response = await Effect.runPromise(
        evaluateChallenge(
          { apiUrl: "https://hack.example", token: "oauth-token" },
          "make-it-fast",
          { kind: "javascript_source", source: "function createLedger() {}" },
        ),
      );
      expect(response.data.exactCount).toBe(85);
      await Effect.runPromise(
        evaluateChallenge(
          { apiUrl: "https://hack.example", token: "oauth-token" },
          "broken-agent",
          {
            kind: "javascript_source",
            source: "function createScheduler() {}",
          },
        ),
      );
      expect(timeouts).toEqual([360_000, 30_000]);
      expect(requests).toEqual([
        "https://hack.example/api/v1/challenges/make-it-fast/evaluate",
        "https://hack.example/api/v1/challenges/broken-agent/evaluate",
      ]);
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });
  test("verifies the supplied token without requiring a registration", async () => {
    let authorization: string | null = null;
    let attribution: string | null = null;
    let method: string | undefined;
    let url = "";
    globalThis.fetch = async (input, init) => {
      url = String(input);
      method = init?.method;
      const headers = new Headers(init?.headers);
      authorization = headers.get("authorization");
      attribution = headers.get("x-chofex-campaign-attribution");
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-auth",
        data: {
          authenticated: true,
          userId: "user_123",
          email: "ada@example.com",
          tokenType: "oauth_token",
        },
      });
    };

    const response = await Effect.runPromise(
      getCurrentUser({
        apiUrl: "https://hack.example",
        campaignAttribution: {
          capturedAt: 1_789_819_200_000,
          landingId: "018f47a2-89ab-7def-8123-456789abcdef",
        },
        token: "oauth-token",
      }),
    );

    expect(authorization).toBe("Bearer oauth-token");
    expect(attribution).toBe(
      "018f47a2-89ab-7def-8123-456789abcdef.1789819200000",
    );
    expect(method).toBe("GET");
    expect(url).toBe("https://hack.example/api/v1/me");
    expect(response.data).toEqual({
      authenticated: true,
      userId: "user_123",
      email: "ada@example.com",
      tokenType: "oauth_token",
    });
  });

  test("sends the supplied bearer token and decodes a v1 response", async () => {
    let authorization: string | null = null;
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-123",
        data: registrationResult,
      });
    };

    const response = await Effect.runPromise(
      getRegistration({ apiUrl: "https://hack.example", token: "oauth-token" }),
    );

    expect(authorization).toBe("Bearer oauth-token");
    expect(response.data.registration.status).toBe("submitted");
  });

  test("reads the generated badge URL", async () => {
    let url = "";
    globalThis.fetch = async (input) => {
      url = String(input);
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-badge",
        data: {
          status: "completed",
          url: "https://store.public.blob.vercel-storage.com/badge.png",
        },
      });
    };

    const response = await Effect.runPromise(
      getBadge({ apiUrl: "https://hack.example", token: "oauth-token" }),
    );

    expect(url).toBe("https://hack.example/api/v1/badge");
    expect(response.data.url).toContain("badge.png");
  });

  test("updates the badge profile and starts regeneration", async () => {
    let method = "";
    let body: unknown;
    globalThis.fetch = async (_input, init) => {
      method = init?.method ?? "";
      body = JSON.parse(String(init?.body));
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-regenerate",
        data: { status: "pending" },
      });
    };

    const response = await Effect.runPromise(
      regenerateBadge(
        { apiUrl: "https://hack.example", token: "oauth-token" },
        {
          fullName: "Ada Lovelace",
          oneLiner: "Computing pioneer",
          linkUrl: "https://ada.dev",
          pictureSource: "github",
        },
      ),
    );

    expect(method).toBe("PATCH");
    expect(body).toMatchObject({ linkUrl: "https://ada.dev" });
    expect(response.data.status).toBe("pending");
  });

  test("preserves structured API errors", async () => {
    globalThis.fetch = async () =>
      Response.json(
        {
          version: 1,
          ok: false,
          requestId: "request-456",
          error: {
            code: "REGISTRATION_NOT_FOUND",
            message: "Registration not found",
            retryable: false,
          },
        },
        { status: 404 },
      );

    const error = await Effect.runPromise(
      Effect.flip(
        getRegistration({
          apiUrl: "https://hack.example",
          token: "oauth-token",
        }),
      ),
    );

    expect(error.code).toBe("REGISTRATION_NOT_FOUND");
    expect(error.requestId).toBe("request-456");
  });

  test("explains how to recover from a post-login authentication rejection", async () => {
    expect(
      authenticationRecoveryMessage(
        "AUTHENTICATION_REQUIRED",
        "Authentication failed",
      ),
    ).toContain("andes update");

    globalThis.fetch = async () =>
      Response.json(
        {
          version: 1,
          ok: false,
          requestId: "request-auth-failed",
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication failed",
            retryable: false,
          },
        },
        { status: 401 },
      );

    const error = await Effect.runPromise(
      Effect.flip(
        getCurrentUser({
          apiUrl: "https://hack.example",
          token: "oauth-token",
        }),
      ),
    );

    expect(error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(error.requestId).toBe("request-auth-failed");
    expect(error.message).toContain("andes logout");
  });

  test("ignores additive fields in a v1 response", async () => {
    globalThis.fetch = async () =>
      Response.json({
        version: 1,
        ok: true,
        requestId: "request-789",
        data: registrationResult,
        unexpected: true,
      });

    const response = await Effect.runPromise(
      getRegistration({
        apiUrl: "https://hack.example",
        token: "oauth-token",
      }),
    );

    expect(response.data.registration.id).toBe("registration-123");
  });

  test("uses the authenticated two-phase picture upload endpoint", async () => {
    const requests: Array<{ method?: string; body: unknown }> = [];
    globalThis.fetch = async (_input, init) => {
      requests.push({
        method: init?.method,
        body: JSON.parse(String(init?.body)) as unknown,
      });
      if (init?.method === "POST") {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-picture-grant",
          data: {
            pathname: "profile-pictures/u/a/p.png",
            clientToken: "token",
          },
        });
      }
      return Response.json({
        version: 1,
        ok: true,
        requestId: "request-picture-complete",
        data: {
          url: "https://store.public.blob.vercel-storage.com/p.png",
          contentType: "image/png",
          size: 9,
        },
      });
    };
    const options = { apiUrl: "https://hack.example", token: "oauth-token" };

    const grant = await Effect.runPromise(
      beginPictureUpload(options, { contentType: "image/png", size: 9 }),
    );
    const completed = await Effect.runPromise(
      completePictureUpload(options, {
        pathname: grant.data.pathname,
        url: "https://store.public.blob.vercel-storage.com/p.png",
      }),
    );

    expect(completed.data.contentType).toBe("image/png");
    expect(requests).toEqual([
      { method: "POST", body: { contentType: "image/png", size: 9 } },
      {
        method: "PUT",
        body: {
          pathname: "profile-pictures/u/a/p.png",
          url: "https://store.public.blob.vercel-storage.com/p.png",
        },
      },
    ]);
  });
});
