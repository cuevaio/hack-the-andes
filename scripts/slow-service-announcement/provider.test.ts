import { describe, expect, test } from "bun:test";
import { AnnouncementError } from "./campaign";
import { createProvider, retryDelayMs } from "./provider";

function providerWith(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  delays: number[] = [],
) {
  const fetcher: typeof fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) =>
      handler(String(input), init),
    { preconnect: fetch.preconnect },
  );
  return createProvider({
    clerkKey: "test-clerk",
    resendKey: "test-resend",
    fetcher,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
}

describe("provider policy and send boundaries", () => {
  test("fences the campaign immediately before every HTTP attempt, including a retry after ownership is lost", async () => {
    let attempts = 0;
    let checks = 0;
    const events: string[] = [];
    const fetcher: typeof fetch = Object.assign(
      async () => {
        events.push("post");
        attempts++;
        return new Response(null, { status: 429 });
      },
      { preconnect: fetch.preconnect },
    );
    const provider = createProvider({
      clerkKey: "test",
      resendKey: "test",
      fetcher,
      sleep: async () => {},
      beforeRequest: async () => {
        checks++;
        events.push("owner-check");
        if (checks === 2)
          throw new AnnouncementError(
            "Campaign owner lease expired or changed",
          );
      },
    });
    await expect(
      provider.send("immutable-body", "immutable-key", async () => {
        events.push("live-check");
      }),
    ).rejects.toThrow("owner lease");
    expect(attempts).toBe(1);
    expect(events).toEqual([
      "live-check",
      "owner-check",
      "post",
      "live-check",
      "owner-check",
    ]);
  });
  test("paginates the entire contacts and suppression policy using only GET", async () => {
    const requests: string[] = [];
    const provider = providerWith((url, init) => {
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/contacts") && !url.includes("after="))
        return Response.json({
          has_more: true,
          data: [
            {
              id: "page-1",
              email: "subscribed@example.com",
              unsubscribed: false,
            },
          ],
        });
      if (url.includes("/contacts"))
        return Response.json({
          has_more: false,
          data: [
            {
              id: "page-2",
              email: "unsubscribed@example.com",
              unsubscribed: true,
            },
          ],
        });
      if (url.includes("/emails"))
        return Response.json({
          has_more: false,
          data: [
            {
              id: "email-1",
              to: ["soft-bounced@example.com"],
              last_event: "bounced",
            },
          ],
        });
      return Response.json({
        has_more: false,
        data: [
          {
            id: "suppression-1",
            email: "bounced@example.com",
            origin: "bounce",
          },
        ],
      });
    });
    expect(await provider.policy()).toEqual({
      contacts: [
        { id: "page-1", email: "subscribed@example.com", unsubscribed: false },
        { id: "page-2", email: "unsubscribed@example.com", unsubscribed: true },
      ],
      suppressions: [
        { id: "suppression-1", email: "bounced@example.com", origin: "bounce" },
      ],
      emails: [
        {
          id: "email-1",
          to: ["soft-bounced@example.com"],
          last_event: "bounced",
        },
      ],
    });
    expect(requests).toEqual([
      "GET https://api.resend.com/contacts?limit=100",
      "GET https://api.resend.com/contacts?limit=100&after=page-1",
      "GET https://api.resend.com/suppressions?limit=100",
      "GET https://api.resend.com/emails?limit=100",
    ]);
  });
  test("fails closed if policy permission is missing and never exposes provider error bodies", async () => {
    const provider = providerWith(() =>
      Response.json(
        { message: "secret-token recipient@example.com" },
        { status: 403 },
      ),
    );
    await expect(provider.policy()).rejects.toThrow(
      "Resend HTTP 403; refusing to continue",
    );
    const invalid = providerWith(() =>
      Response.json({
        data: [{ email: "private@example.com" }],
        has_more: false,
      }),
    );
    await expect(invalid.policy()).rejects.toThrow(
      "Resend list returned invalid data; refusing to continue",
    );
  });
  test("rechecks the verified current account and latest opt-out before claiming", async () => {
    let optedOut = false;
    const provider = providerWith((url) => {
      if (url.includes("api.clerk.com"))
        return Response.json({
          id: "user",
          banned: false,
          locked: false,
          primary_email_address_id: "primary",
          email_addresses: [
            {
              id: "primary",
              email_address: "current@example.com",
              verification: { status: "verified" },
            },
          ],
        });
      if (url.includes("/contacts/") && optedOut)
        return Response.json({
          id: "contact",
          email: "current@example.com",
          unsubscribed: true,
        });
      return new Response(null, { status: 404 });
    });
    expect(
      await provider.stillReachable({
        clerkUserId: "user",
        email: "current@example.com",
      }),
    ).toBe(true);
    expect(
      await provider.stillReachable({
        clerkUserId: "user",
        email: "historical@example.com",
      }),
    ).toBe(false);
    optedOut = true;
    expect(
      await provider.stillReachable({
        clerkUserId: "user",
        email: "current@example.com",
      }),
    ).toBe(false);
  });
  test("retries rate limits and server errors with an unchanged body/key and a fresh live guard every time", async () => {
    const requests: {
      method: string | undefined;
      key: string | null;
      body: RequestInit["body"];
    }[] = [];
    const delays: number[] = [];
    let guarded = 0;
    const provider = providerWith((_url, init) => {
      requests.push({
        method: init?.method,
        key: new Headers(init?.headers).get("idempotency-key"),
        body: init?.body,
      });
      if (requests.length === 1)
        return new Response(null, {
          status: 429,
          headers: { "retry-after": "2" },
        });
      if (requests.length === 2) return new Response(null, { status: 503 });
      return Response.json({ id: "one-provider-email" });
    }, delays);
    const result = await provider.send(
      '{"to":["test@example.com"],"text":"same snapshot"}',
      "stable-campaign-key",
      async () => {
        guarded++;
      },
    );
    expect(result).toBe("one-provider-email");
    expect(requests).toEqual([
      {
        method: "POST",
        key: "stable-campaign-key",
        body: '{"to":["test@example.com"],"text":"same snapshot"}',
      },
      {
        method: "POST",
        key: "stable-campaign-key",
        body: '{"to":["test@example.com"],"text":"same snapshot"}',
      },
      {
        method: "POST",
        key: "stable-campaign-key",
        body: '{"to":["test@example.com"],"text":"same snapshot"}',
      },
    ]);
    expect(guarded).toBe(3);
    expect(delays).toEqual([700, 2_000, 700, 2_000, 700]);
  });
  test("never sends if the live or retry-window guard refuses, even after a transport failure", async () => {
    let attempts = 0;
    let checks = 0;
    const provider = providerWith(() => {
      attempts++;
      throw new Error("private transport detail");
    });
    await expect(
      provider.send("fixed body", "fixed key", async () => {
        checks++;
        if (checks === 2)
          throw new AnnouncementError("Challenge is no longer open");
      }),
    ).rejects.toThrow("Challenge is no longer open");
    expect(attempts).toBe(1);
    expect(checks).toBe(2);
  });
  test("caps automatic retries and respects Retry-After without unbounded sleeps", async () => {
    let attempts = 0;
    const provider = providerWith(() => {
      attempts++;
      return new Response(null, { status: 429 });
    });
    await expect(
      provider.send("fixed body", "fixed key", async () => {}),
    ).rejects.toThrow("retries exhausted");
    expect(attempts).toBe(5);
    expect(retryDelayMs("99999", 0)).toBe(60_000);
    expect(retryDelayMs(null, 0)).toBe(1_000);
  });
});
