import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.skipIf(process.platform !== "linux")(
  "OAuth refresh and logout do not forward token bodies through redirects",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "andes-oauth-test-"));
    let redirectedRequests = 0;
    const server = Bun.serve({
      port: 0,
      fetch: (request) => {
        if (new URL(request.url).pathname.startsWith("/oauth/")) {
          return new Response(null, {
            status: 307,
            headers: { location: "/unexpected" },
          });
        }
        redirectedRequests += 1;
        return Response.json({ access_token: "new-access-token" });
      },
    });
    try {
      await writeFile(
        join(directory, "secret-tool"),
        '#!/bin/sh\nif [ "$1" = "lookup" ]; then\n  printf \'%s\' \'{"accessToken":"local-test-access","refreshToken":"local-test-refresh","expiresAt":0}\'\nfi\n',
        { mode: 0o700 },
      );
      const authPath = new URL("../src/auth.ts", import.meta.url).pathname;
      for (const operation of ["authentication(true)", "logout()"] as const) {
        const child = Bun.spawn(
          [
            process.execPath,
            "--eval",
            `
        import assert from "node:assert/strict";
        import { authentication, logout } from ${JSON.stringify(authPath)};
        await assert.rejects(() => ${operation}, /redirect/i);
      `,
          ],
          {
            env: {
              ...process.env,
              PATH: `${directory}:${process.env.PATH}`,
              CHOFEX_TOKEN: "",
              CHOFEX_OAUTH_ISSUER: server.url.toString().replace(/\/$/, ""),
            },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const [code, diagnostics] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
        ]);
        expect({ code, diagnostics }).toEqual({ code: 0, diagnostics: "" });
      }
      expect(redirectedRequests).toBe(0);
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  },
);
