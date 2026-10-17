import { expect, test } from "bun:test";
import { creditsText } from "../src/credits-command";

test("credits displays codes, links and redemption conditions", () => {
  expect(
    creditsText({
      credits: [
        {
          sponsor: "Tavily",
          benefit: "8,000 créditos gratis",
          code: "ANDESHACK",
          url: "https://app.tavily.com/redeem/ANDESHACK",
          instructions: ["Válido del 17 al 19 de octubre de 2026."],
        },
      ],
    }),
  ).toBe(
    "Tavily\n8,000 créditos gratis\nCódigo: ANDESHACK\nCanjear: https://app.tavily.com/redeem/ANDESHACK\nVálido del 17 al 19 de octubre de 2026.",
  );
});
for (const allowed of [false, true])
  test(`credits JSON command preserves API result, allowed=${allowed}`, async () => {
    const body = allowed
      ? {
          version: 1,
          ok: true,
          requestId: "credits-test",
          data: { credits: [] },
        }
      : {
          version: 1,
          ok: false,
          requestId: "credits-test",
          error: {
            code: "CHECKIN_REQUIRED",
            message: "Confirma tu llegada.",
            retryable: false,
          },
        };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        expect(new URL(request.url).pathname).toBe("/api/v1/credits");
        expect(request.headers.get("authorization")).toBe("Bearer test-token");
        return Response.json(body, { status: allowed ? 200 : 403 });
      },
    });
    try {
      const child = Bun.spawn(
        [
          process.execPath,
          "src/index.ts",
          "--api-url",
          server.url.toString(),
          "--token",
          "test-token",
          "--output",
          "json",
          "credits",
        ],
        {
          cwd: new URL("..", import.meta.url).pathname,
          env: { ...process.env, CHOFEX_AUTO_UPDATE: "0" },
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
        },
      );
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(code).toBe(allowed ? 0 : 2);
      expect(stdout.trim().split("\n")).toHaveLength(1);
      expect(JSON.parse(stdout)).toEqual(body);
      expect(stderr).toBe("");
    } finally {
      server.stop(true);
    }
  });
