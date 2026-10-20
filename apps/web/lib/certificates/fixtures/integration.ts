import { mock } from "bun:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/pglite";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createCheckinFixture } from "@/lib/admin/fixtures/checkin-database";
import { HttpError } from "@/lib/registration/http";

const fixture = await createCheckinFixture();
const { client } = fixture;
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
let actor: string | null = null;
mock.module("@/lib/auth", () => ({
  requireAuthenticatedParticipant: async () => {
    if (!actor)
      throw new HttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication required",
      );
    return { clerkUserId: actor, tokenType: "session_token" };
  },
}));
const route = await import("@/app/api/v1/certificate/route");
const download = await import("@/app/certificate/[id]/[format]/route");
const { findCertificate, issueCertificate } = await import("../service");
const { issueCheckin, adminCheckin } = await import("@/lib/teams/service");
const { certificateUrl, linkedinCertificateUrl, linkedinShareUrl } =
  await import("../links");
const request = () =>
  new Request("https://hacktheandes.com/api/v1/certificate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clerkUserId: "someone-else",
      recipientName: "Forged Name",
      checkedIn: true,
    }),
  });
async function file(id: string, format: string) {
  return download.GET(
    new Request(`https://hacktheandes.com/certificate/${id}/${format}`),
    { params: Promise.resolve({ id, format }) },
  );
}

try {
  assert.equal((await route.POST(request())).status, 401);
  const ana = await fixture.seed({
    name: "Ana María Pérez",
    legalName: "SECRET LEGAL NAME",
    email: "private@example.com",
    document: "12345678",
    confirmed: true,
  });
  actor = ana.clerkUserId;
  const refused = await route.POST(request());
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.code, "CERTIFICATE_NOT_ELIGIBLE");
  await assert.rejects(
    client.query(
      "insert into participation_certificates(application_id,recipient_name) values($1,'Forgery')",
      [ana.applicationId],
    ),
    /require.*check-in/,
  );
  const token = await issueCheckin(actor);
  assert.equal(token.checkedIn, false);
  if (!token.token) throw new Error("Expected check-in token");
  await adminCheckin("fixture-admin", token.token, false);
  await assert.rejects(issueCertificate(actor), /check-in/);
  await adminCheckin("fixture-admin", token.token, true);

  const [first, repeated] = await Promise.all([
    issueCertificate(actor),
    issueCertificate(actor),
  ]);
  assert.deepEqual(first, repeated);
  assert.match(first.id, /^HTA-2026-[A-F0-9]{32}$/);
  assert.equal(first.recipientName, "Ana María Pérez");
  assert.equal(first.status, "valid");
  const claim = () =>
    client.query(
      "insert into participation_certificate_deliveries(certificate_id,email,payload_hash) values($1,'ana@example.com',$2) on conflict do nothing returning certificate_id",
      [first.id, "a".repeat(64)],
    );
  const claims = await Promise.all([claim(), claim()]);
  assert.equal(
    claims.reduce((count, result) => count + result.rows.length, 0),
    1,
  );
  await client.query(
    "update participation_certificate_deliveries set status='sent',provider_id='provider-receipt',sent_at=now() where certificate_id=$1",
    [first.id],
  );
  assert.equal((await claim()).rows.length, 0);
  assert.equal(
    (
      await client.query<{ n: number }>(
        "select count(*)::int as n from participation_certificates",
      )
    ).rows[0]?.n,
    1,
  );
  const fromRoute = await route.POST(request());
  assert.equal(fromRoute.status, 200);
  assert.deepEqual((await fromRoute.json()).data, {
    certificate: first,
    url: certificateUrl(first.id),
  });
  const api = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      assert.equal(new URL(request.url).pathname, "/api/v1/certificate");
      assert.equal(
        request.headers.get("authorization"),
        "Bearer certificate-fixture",
      );
      return route.POST(request);
    },
  });
  try {
    const args = [
      process.execPath,
      new URL("../../../../cli/src/index.ts", import.meta.url).pathname,
      "--api-url",
      api.url.toString(),
      "--token",
      "certificate-fixture",
      "--output",
      "json",
      "certificate",
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      const child = Bun.spawn(args, {
        env: { ...process.env, CHOFEX_AUTO_UPDATE: "0" },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      assert.equal(exit, 0);
      assert.equal(stderr, "");
      assert.equal(stdout.trim().split("\n").length, 1);
      const result = JSON.parse(stdout);
      assert.deepEqual(result.data, {
        certificate: first,
        url: certificateUrl(first.id),
      });
    }
  } finally {
    api.stop(true);
  }
  assert.deepEqual(await findCertificate(first.id), first);
  assert.deepEqual(Object.keys(first).sort(), [
    "id",
    "issuedAt",
    "recipientName",
    "status",
  ]);
  assert.ok(!JSON.stringify(first).includes("SECRET LEGAL NAME"));
  await client.query(
    "update participants set name='Changed later' where id=$1",
    [ana.participantId],
  );
  assert.deepEqual(await issueCertificate(actor), first);
  const other = await fixture.seed({
    name: "Otro participante",
    legalName: "Private",
    document: "87654321",
    confirmed: true,
  });
  actor = other.clerkUserId;
  assert.equal((await route.POST(request())).status, 409);
  assert.equal(await findCertificate(`HTA-2026-${"F".repeat(32)}`), null);
  assert.equal(await findCertificate("bad-id"), null);
  assert.equal((await file("bad-id", "certificate.pdf")).status, 404);
  assert.equal((await file(first.id, "certificate.svg")).status, 404);

  // Anyone with the public URL can validate and download an issued, valid record.
  actor = null;
  const [pdf, png] = await Promise.all([
    file(first.id, "certificate.pdf"),
    file(first.id, "certificate.png"),
  ]);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition") ?? "", /attachment/);
  assert.equal(png.status, 200);
  assert.equal(png.headers.get("content-type"), "image/png");
  assert.equal(png.headers.get("cache-control"), "no-store");
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  const pngBytes = Buffer.from(await png.arrayBuffer());
  const document = await PDFDocument.load(pdfBytes);
  assert.equal(document.getPageCount(), 1);
  assert.ok(Math.abs(document.getPage(0).getWidth() - 841.8898) < 0.01);
  const image = await sharp(pngBytes).metadata();
  assert.equal(image.width, 3508);
  assert.equal(image.height, 2481);
  assert.equal(image.density, 300);
  assert.equal(
    certificateUrl(first.id),
    `https://hacktheandes.com/certificate/${first.id}`,
  );
  assert.equal(
    new URL(linkedinShareUrl(first.id)).searchParams.get("url"),
    certificateUrl(first.id),
  );
  assert.equal(
    new URL(linkedinCertificateUrl).searchParams.get("startTask"),
    "CERTIFICATION_NAME",
  );
  if (process.env.CERTIFICATE_TEST_OUTPUT) {
    await mkdir(process.env.CERTIFICATE_TEST_OUTPUT, { recursive: true });
    await writeFile(
      `${process.env.CERTIFICATE_TEST_OUTPUT}/demo-not-issued.pdf`,
      pdfBytes,
    );
    await writeFile(
      `${process.env.CERTIFICATE_TEST_OUTPUT}/demo-not-issued.png`,
      pngBytes,
    );
    await writeFile(
      `${process.env.CERTIFICATE_TEST_OUTPUT}/demo.json`,
      JSON.stringify({ ...first, verificationUrl: certificateUrl(first.id) }),
    );
  }
  await client.query(
    "update acceptance_details set checked_in_at=null where application_id=$1",
    [ana.applicationId],
  );
  assert.equal((await findCertificate(first.id))?.status, "revoked");
  assert.equal((await file(first.id, "certificate.pdf")).status, 404);
  await client.query(
    "update acceptance_details set checked_in_at=now() where application_id=$1",
    [ana.applicationId],
  );
  await client.query(
    "update participation_certificates set revoked_at=now() where id=$1",
    [first.id],
  );
  assert.equal((await findCertificate(first.id))?.status, "revoked");
  actor = ana.clerkUserId;
  assert.equal((await route.POST(request())).status, 403);
  assert.equal((await file(first.id, "certificate.png")).status, 404);
  await client.query(
    "update participation_certificates set revoked_at=null where id=$1",
    [first.id],
  );
  await client.query("update applications set status='withdrawn' where id=$1", [
    ana.applicationId,
  ]);
  assert.equal((await findCertificate(first.id))?.status, "revoked");
  await assert.rejects(issueCertificate(ana.clerkUserId), /check-in/);
  const unnamed = await fixture.seed({
    name: " ",
    legalName: "Must stay private",
    document: "99999999",
    confirmed: true,
  });
  await client.query(
    "update acceptance_details set checked_in_at=now() where application_id=$1",
    [unnamed.applicationId],
  );
  await assert.rejects(issueCertificate(unnamed.clerkUserId), /nombre público/);
  console.log("certificates integration passed");
} finally {
  await client.close();
}
