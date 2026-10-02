import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { Schema } from "effect";
import { decode } from "./campaign";

const entrypoint = resolve(import.meta.dir, "../announce-slow-service.ts");

test("preview renders the actual HTML and text without credentials, database access or provider sends", async () => {
  const process = Bun.spawn(["bun", "--no-env-file", entrypoint, "--preview"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: Bun.env.PATH },
  });
  const stdout = await new Response(process.stdout).text();
  expect(await process.exited).toBe(0);
  expect(await new Response(process.stderr).text()).toBe("");
  const preview = decode(
    Schema.Struct({
      subject: Schema.String,
      contentHash: Schema.String,
      htmlPath: Schema.String,
      textPath: Schema.String,
      sends: Schema.Number,
    }),
    JSON.parse(stdout),
    "Preview",
  );
  expect(preview.subject).toBe(
    "El servicio lento: trabaja con tu agente y revisa la solución",
  );
  expect(preview.sends).toBe(0);
  expect(preview.contentHash).toMatch(/^[a-f0-9]{64}$/);
  const html = await Bun.file(preview.htmlPath).text();
  const text = await Bun.file(preview.textPath).text();
  expect(html).toContain("The Slow Service");
  expect(html).toContain(
    "https://hacktheandes.com/challenges/make-it-fast?utm_source=resend",
  );
  expect(text).toContain("El challenge 2, The Scheduler, ya cerró.");
  expect(text).toContain("chofex challenge init --challenge make-it-fast");
});

test("the executable rejects --send without confirmation before loading production credentials", async () => {
  const process = Bun.spawn(["bun", "--no-env-file", entrypoint, "--send"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: Bun.env.PATH },
  });
  expect(await process.exited).toBe(1);
  expect(await new Response(process.stdout).text()).toBe("");
  const stderr = await new Response(process.stderr).text();
  expect(JSON.parse(stderr)).toEqual({
    campaignId: "challenge-launch/slow-service-v3",
    error:
      "Sending requires --send --confirm-live-challenge without preview/dry-run/count",
  });
});

test("the executable refuses Bun's automatic development environment loading", async () => {
  const process = Bun.spawn(["bun", entrypoint, "--dry-run"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: Bun.env.PATH },
  });
  expect(await process.exited).toBe(1);
  expect(await new Response(process.stdout).text()).toBe("");
  expect(JSON.parse(await new Response(process.stderr).text())).toEqual({
    campaignId: "challenge-launch/slow-service-v3",
    error:
      "Run with bun --no-env-file; automatic development environment loading is not allowed",
  });
});
