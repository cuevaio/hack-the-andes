import { Schema } from "effect";
import {
  AccountSchema,
  AnnouncementError,
  ContactSchema,
  canonicalEmail,
  decode,
  normalizeEmail,
  SentEmailSchema,
  SuppressionSchema,
} from "./campaign";

export const retryDelayMs = (header: string | null, attempt: number) => {
  const seconds = Number(header);
  if (header && Number.isFinite(seconds))
    return Math.min(60_000, Math.max(1_000, seconds * 1_000));
  if (header) {
    const until = Date.parse(header) - Date.now();
    if (Number.isFinite(until)) return Math.min(60_000, Math.max(1_000, until));
  }
  return Math.min(30_000, 1_000 * 2 ** attempt);
};

export function createProvider(input: {
  clerkKey: string;
  resendKey: string;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  beforeRequest?: () => Promise<void>;
}) {
  const fetcher = input.fetcher ?? fetch;
  const sleep = input.sleep ?? Bun.sleep;
  async function request(
    service: "Clerk" | "Resend",
    path: string,
    init: RequestInit = {},
    beforeAttempt?: () => Promise<void>,
  ) {
    const origin =
      service === "Clerk"
        ? "https://api.clerk.com/v1"
        : "https://api.resend.com";
    const key = service === "Clerk" ? input.clerkKey : input.resendKey;
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(700);
      if (beforeAttempt) await beforeAttempt();
      if (input.beforeRequest) await input.beforeRequest();
      let response: Response;
      try {
        response = await fetcher(`${origin}${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
            "user-agent": "hack-the-andes/slow-service-announcement",
            ...init.headers,
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        // POSTs may have succeeded before the connection failed. Every retry
        // carries exactly the same body and Resend idempotency key.
        if (attempt === 4)
          throw new AnnouncementError(
            `${service} transport failed; resume with the same campaign`,
          );
        await sleep(retryDelayMs(null, attempt));
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 4)
          throw new AnnouncementError(
            `${service} retries exhausted; resume with the same campaign`,
          );
        await sleep(retryDelayMs(response.headers.get("retry-after"), attempt));
        continue;
      }
      if (!response.ok && response.status !== 404)
        throw new AnnouncementError(
          `${service} HTTP ${response.status}; refusing to continue`,
        );
      return response;
    }
    throw new AnnouncementError("Provider retries exhausted");
  }
  async function json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new AnnouncementError("Provider returned invalid JSON");
    }
  }
  async function list<
    S extends Schema.Top & { readonly DecodingServices: never },
  >(path: string, schema: S) {
    const rows: S["Type"][] = [];
    let after: string | undefined;
    const seen = new Set<string>();
    while (true) {
      let query = `${path}?limit=100`;
      if (after) query += `&after=${encodeURIComponent(after)}`;
      const response = await request("Resend", query);
      const page = decode(
        Schema.Struct({ data: Schema.Array(schema), has_more: Schema.Boolean }),
        await json(response),
        "Resend list",
      );
      rows.push(...page.data);
      if (!page.has_more) return rows;
      const last = decode(
        Schema.Struct({ id: Schema.String }),
        page.data.at(-1),
        "Resend pagination",
      );
      if (seen.has(last.id))
        throw new AnnouncementError("Resend pagination did not advance");
      seen.add(last.id);
      after = last.id;
    }
  }
  return {
    async accounts() {
      const rows: (typeof AccountSchema.Type)[] = [];
      for (let offset = 0; ; offset += 100) {
        const response = await request(
          "Clerk",
          `/users?limit=100&offset=${offset}&order_by=%2Bcreated_at`,
        );
        const page = decode(
          Schema.Array(AccountSchema),
          await json(response),
          "Clerk users",
        );
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    },
    async policy() {
      // A sending-only key cannot read these endpoints. Fail closed, never
      // replace missing policy data with an empty suppression list.
      const contacts = await list("/contacts", ContactSchema);
      const suppressions = await list("/suppressions", SuppressionSchema);
      const emails = await list("/emails", SentEmailSchema);
      return { contacts, suppressions, emails };
    },
    async stillReachable(recipient: { clerkUserId: string; email: string }) {
      const response = await request(
        "Clerk",
        `/users/${encodeURIComponent(recipient.clerkUserId)}`,
      );
      if (response.status === 404) return false;
      const account = decode(
        AccountSchema,
        await json(response),
        "Clerk account",
      );
      if (canonicalEmail(account) !== normalizeEmail(recipient.email))
        return false;
      const encoded = encodeURIComponent(recipient.email);
      const contact = await request("Resend", `/contacts/${encoded}`);
      if (
        contact.status !== 404 &&
        decode(ContactSchema, await json(contact), "Resend contact")
          .unsubscribed
      )
        return false;
      const suppression = await request("Resend", `/suppressions/${encoded}`);
      if (suppression.status !== 404) {
        decode(
          SuppressionSchema,
          await json(suppression),
          "Resend suppression",
        );
        return false;
      }
      return true;
    },
    async send(
      body: string,
      idempotencyKey: string,
      beforeAttempt: () => Promise<void>,
    ) {
      const response = await request(
        "Resend",
        "/emails",
        {
          method: "POST",
          body,
          headers: { "idempotency-key": idempotencyKey },
        },
        beforeAttempt,
      );
      if (!response.ok)
        throw new AnnouncementError(
          `Resend HTTP ${response.status}; refusing to continue`,
        );
      return decode(
        Schema.Struct({ id: Schema.String }),
        await json(response),
        "Resend delivery",
      ).id;
    },
  };
}
