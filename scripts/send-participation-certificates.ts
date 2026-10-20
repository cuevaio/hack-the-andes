import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ParticipationCertificateSchema } from "@chofex/registration-contract";
import { neon } from "@neondatabase/serverless";
import { Schema } from "effect";
import { PDFDocument } from "pdf-lib";
import { certificateEmail } from "../apps/web/lib/certificates/email";
import { certificateUrl } from "../apps/web/lib/certificates/links";
import { parseEnvironment } from "./deploy-environment";
import { canonicalEmail } from "./slow-service-announcement/campaign";
import { createProvider } from "./slow-service-announcement/provider";

const candidateSchema = Schema.Struct({
  clerkUserId: Schema.String,
  applicationId: Schema.String,
  name: Schema.String,
});
type Candidate = typeof candidateSchema.Type;
export const mailStage = "participation-certificate-2026-v1";

export function certificateMailPayload(input: {
  certificate: typeof ParticipationCertificateSchema.Type;
  email: string;
  pdf: Buffer;
}) {
  return {
    from: "Hack the Andes <hi@cueva.io>",
    reply_to: "hi@cueva.io",
    to: [input.email],
    ...certificateEmail(input.certificate),
    attachments: [
      {
        filename: `Hack-the-Andes-${input.certificate.id}.pdf`,
        content: input.pdf.toString("base64"),
      },
    ],
    tags: [
      { name: "campaign", value: mailStage },
      { name: "certificate", value: input.certificate.id },
    ],
  };
}

async function environment() {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: import.meta.dir,
    encoding: "utf8",
  }).trim();
  const root = dirname(resolve(import.meta.dir, common));
  const values = {
    ...parseEnvironment(
      await readFile(join(root, ".env.production.local"), "utf8"),
    ),
    ...process.env,
  };
  function required(key: string) {
    const value = values[key];
    if (!value) throw new Error(`${key} is not configured`);
    return value;
  }
  return {
    database: required("NEW_DATABASE_URL"),
    clerk: required("CLERK_SECRET_KEY"),
    resend: required("RESEND_API_KEY"),
    root,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const send = args.includes("--send");
  const verify = args.includes("--verify");
  function option(name: string) {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`${name} requires a value`);
    return value;
  }
  const release = option("--release");
  const expected = option("--expected-count");
  const limit = Number(option("--limit") ?? "10000");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid --limit");
  if (send && (!release || !/^[a-f0-9]{40}$/.test(release) || !expected))
    throw new Error(
      "Sending requires --release <full deployed SHA> and --expected-count <planned count>",
    );
  const env = await environment();
  const output = resolve(
    option("--output") ??
      join(env.root, "output/participation-certificates/campaign"),
  );
  await mkdir(output, { recursive: true, mode: 0o700 });
  const db = neon(env.database);
  let requestCount = 0;
  const provider = createProvider({
    clerkKey: env.clerk,
    resendKey: env.resend,
    beforeRequest: async () => {
      requestCount++;
      if (requestCount % 20 === 0)
        console.log(JSON.stringify({ providerChecks: requestCount }));
    },
  });
  const rows = Schema.decodeUnknownSync(Schema.Array(candidateSchema))(
    await db`select p.clerk_user_id as "clerkUserId", a.id as "applicationId", coalesce(p.name,'') as name from participants p join applications a on a.participant_id=p.id join acceptance_details d on d.application_id=a.id where a.status='accepted' and d.checked_in_at is not null order by p.id`,
  );
  if (verify) {
    const deliveries =
      await db`select certificate_id,email,provider_id from participation_certificate_deliveries where status='sent' order by certificate_id`;
    const events: Record<string, number> = {};
    for (const delivery of deliveries) {
      await Bun.sleep(600);
      const response = await fetch(
        `https://api.resend.com/emails/${encodeURIComponent(delivery.provider_id)}`,
        {
          headers: { authorization: `Bearer ${env.resend}` },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Cannot verify provider delivery: HTTP ${response.status}`,
        );
      const record = Schema.decodeUnknownSync(
        Schema.Struct({
          id: Schema.String,
          to: Schema.Array(Schema.String),
          from: Schema.String,
          reply_to: Schema.Array(Schema.String),
          subject: Schema.String,
          last_event: Schema.String,
        }),
      )(await response.json());
      if (
        record.id !== delivery.provider_id ||
        !record.to.includes(delivery.email) ||
        !record.reply_to.includes("hi@cueva.io") ||
        !record.from.includes("hi@cueva.io") ||
        record.subject !== "¡Felicitaciones por participar en Hack the Andes!"
      )
        throw new Error("Provider delivery identity or content mismatch");
      events[record.last_event] = (events[record.last_event] ?? 0) + 1;
    }
    console.log(JSON.stringify({ verified: deliveries.length, events }));
    return;
  }
  const accounts = await provider.accounts();
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const scopedEmails: string[] = [];
  for (const row of rows) {
    const account = accountById.get(row.clerkUserId);
    const email = account && canonicalEmail(account);
    if (email) scopedEmails.push(email);
  }
  const policy = await provider.recipientPolicy(scopedEmails);
  const excludedEmails = new Set([
    ...policy.contacts
      .filter((contact) => contact.unsubscribed)
      .map((contact) => contact.email.trim().toLowerCase()),
    ...policy.suppressions.map((entry) => entry.email.trim().toLowerCase()),
  ]);
  const emails = new Set<string>();
  const recipients: (Candidate & { email: string })[] = [];
  let unreachable = 0;
  for (const row of rows) {
    const account = accountById.get(row.clerkUserId);
    const email = account && canonicalEmail(account);
    if (!email || excludedEmails.has(email) || emails.has(email)) {
      unreachable++;
      continue;
    }
    if (!row.name.trim())
      throw new Error(
        "An eligible participant needs a public name before certificate issuance",
      );
    emails.add(email);
    recipients.push({ ...row, email });
  }
  const plan = {
    campaign: mailStage,
    checkedIn: rows.length,
    reachable: recipients.length,
    excluded: unreachable,
    recipients,
  };
  await writeFile(join(output, "plan.json"), JSON.stringify(plan, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      campaign: mailStage,
      checkedIn: rows.length,
      reachable: recipients.length,
      excluded: unreachable,
      send,
    }),
  );
  if (!send) return;
  if (Number(expected) !== rows.length)
    throw new Error("Check-in count changed; review a new plan before sending");
  const health = await fetch("https://hacktheandes.com/api/health", {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const healthBody: unknown = await health.json();
  if (
    !health.ok ||
    !healthBody ||
    typeof healthBody !== "object" ||
    !("revision" in healthBody) ||
    healthBody.revision !== release
  )
    throw new Error(
      "The approved certificate release is not healthy in production",
    );
  let sent = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    if (sent >= limit) break;
    const issued =
      await db`select hackathon_issue_certificate(${recipient.clerkUserId}) as result`;
    const certificate = Schema.decodeUnknownSync(
      ParticipationCertificateSchema,
    )(issued[0]?.result);
    if (certificate.status !== "valid") {
      skipped++;
      continue;
    }
    const [existing] =
      await db`select status from participation_certificate_deliveries where certificate_id=${certificate.id}`;
    if (existing?.status === "sent") {
      skipped++;
      continue;
    }
    if (existing)
      throw new Error(
        `Certificate ${certificate.id} has an unresolved prior delivery; reconcile before resuming`,
      );
    const url = certificateUrl(certificate.id);
    const page = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const html = await page.text();
    if (
      !page.ok ||
      !html.includes(certificate.id) ||
      !html.includes("Certificado verificado")
    )
      throw new Error(
        `Public certificate page is not valid: ${certificate.id}`,
      );
    const response = await fetch(`${url}/certificate.pdf`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("application/pdf")
    )
      throw new Error(`Cannot download certificate PDF: ${certificate.id}`);
    const pdf = Buffer.from(await response.arrayBuffer());
    if (
      pdf.length > 8 * 1024 * 1024 ||
      !pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))
    )
      throw new Error("Invalid certificate PDF attachment");
    const document = await PDFDocument.load(pdf);
    if (
      document.getPageCount() !== 1 ||
      !document.getSubject()?.includes(certificate.id) ||
      !document.getTitle()?.startsWith(certificate.recipientName)
    )
      throw new Error("PDF attachment does not belong to its recipient");
    const body = JSON.stringify(
      certificateMailPayload({ certificate, email: recipient.email, pdf }),
    );
    const hash = createHash("sha256").update(body).digest("hex");
    await writeFile(join(output, `${certificate.id}.json`), body, {
      mode: 0o600,
    });
    const claimed =
      await db`insert into participation_certificate_deliveries(certificate_id,email,payload_hash) select c.id,${recipient.email},${hash} from participation_certificates c join applications a on a.id=c.application_id join acceptance_details d on d.application_id=a.id where c.id=${certificate.id} and c.revoked_at is null and a.status='accepted' and d.checked_in_at is not null on conflict do nothing returning certificate_id`;
    if (!claimed.length) {
      skipped++;
      continue;
    }
    let providerId: string;
    try {
      providerId = await provider.send(
        body,
        `${mailStage}/${certificate.id}`,
        async () => {
          const [record] =
            await db`select c.id from participation_certificate_deliveries delivery join participation_certificates c on c.id=delivery.certificate_id join applications a on a.id=c.application_id join acceptance_details d on d.application_id=a.id where c.id=${certificate.id} and delivery.status='sending' and delivery.payload_hash=${hash} and delivery.started_at > now()-interval '23 hours' and c.revoked_at is null and a.status='accepted' and d.checked_in_at is not null`;
          if (!record || !(await provider.stillReachable(recipient)))
            throw new Error(
              "Recipient or certificate eligibility changed before dispatch",
            );
        },
      );
    } catch (error) {
      await db`update participation_certificate_deliveries set error='Delivery needs reconciliation; do not automatically resend' where certificate_id=${certificate.id} and status='sending'`;
      throw error;
    }
    await writeFile(
      join(output, `${certificate.id}.receipt.json`),
      JSON.stringify({ id: certificate.id, providerId, payloadHash: hash }),
      { mode: 0o600 },
    );
    await db`update participation_certificate_deliveries set status='sent',provider_id=${providerId},sent_at=now(),error=null where certificate_id=${certificate.id} and payload_hash=${hash} and status='sending'`;
    sent++;
    if (sent % 5 === 0 || sent === limit)
      console.log(JSON.stringify({ sent, skipped, total: recipients.length }));
  }
  console.log(
    JSON.stringify({ complete: true, sent, skipped, total: recipients.length }),
  );
}

if (import.meta.main)
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Certificate campaign failed",
    );
    process.exitCode = 1;
  });
