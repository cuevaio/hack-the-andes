import { expect, test } from "bun:test";

const id = `HTA-2026-${"A".repeat(32)}`;
const url = `https://hacktheandes.com/certificate/${id}`;
const certificate = {
  id,
  recipientName: "Ana María Pérez",
  issuedAt: "2026-10-20T17:00:00Z",
  status: "valid",
};

for (const mode of ["human", "json"] as const) {
  test(`certificate prints the canonical public URL in ${mode} mode`, async () => {
    const body = {
      version: 1,
      ok: true,
      requestId: "certificate-test",
      data: { certificate, url },
    };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        expect(request.method).toBe("POST");
        expect(new URL(request.url).pathname).toBe("/api/v1/certificate");
        expect(request.headers.get("authorization")).toBe("Bearer test-token");
        return Response.json(body);
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
          mode,
          "certificate",
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
      expect(code).toBe(0);
      expect(stderr).toBe("");
      if (mode === "json") {
        expect(stdout.trim().split("\n")).toHaveLength(1);
        expect(JSON.parse(stdout)).toEqual(body);
      } else
        expect(stdout.trim()).toBe(
          `Certificado de participación · Ana María Pérez\nID: ${id}\n\n${url}\n\nAbre el enlace para descargar tu certificado o añadirlo a LinkedIn.`,
        );
    } finally {
      server.stop(true);
    }
  });
}

for (const code of ["CERTIFICATE_NOT_ELIGIBLE", "CERTIFICATE_REVOKED"]) {
  test(`certificate JSON preserves ${code} without printing a certificate URL`, async () => {
    const body = {
      version: 1,
      ok: false,
      requestId: "certificate-test",
      error: {
        code,
        message: "Comunícate con la organización.",
        retryable: false,
      },
    };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => Response.json(body, { status: 403 }),
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
          "certificate",
        ],
        {
          cwd: new URL("..", import.meta.url).pathname,
          env: { ...process.env, CHOFEX_AUTO_UPDATE: "0" },
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
        },
      );
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exit).toBe(2);
      expect(stdout.trim().split("\n")).toHaveLength(1);
      expect(JSON.parse(stdout)).toEqual(body);
      expect(stderr).toBe("");
    } finally {
      server.stop(true);
    }
  });
}
