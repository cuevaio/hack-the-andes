import { expect, test } from "bun:test";

const probe = `
  import { NextRequest } from "next/server";
  import { NextFetchEvent } from "next/dist/server/web/spec-extension/fetch-event";
  import proxy from "./proxy";

  const request = new NextRequest(new URL(process.argv[1], "https://example.com"));
  const event = new NextFetchEvent({ request, page: "/proxy", context: undefined });
  const response = await proxy(request, event);
  if (!response) throw new Error("Proxy did not return a response");
  console.log(JSON.stringify({
    status: response.status,
    authentication: response.headers.get("x-middleware-request-x-clerk-auth-status"),
  }));
`;

test.each([
  ["/challenges/broken-agent/approve/approval_1", "signed-out"],
  ["/challenges/make-it-fast/approve/approval_1", "signed-out"],
  ["/challenges/future-challenge/approve/approval_1", "signed-out"],
  ["/challenges", null],
  ["/challenges/make-it-fast", null],
  ["/api/v1/challenges/make-it-fast/ranking", null],
])(
  "proxy supplies the expected authentication for %s",
  async (pathname, authentication) => {
    const child = Bun.spawn([process.execPath, "--eval", probe, pathname], {
      cwd: import.meta.dir,
      env: {
        ...process.env,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
        CLERK_SECRET_KEY: "sk_live_test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ exitCode, stdout, stderr }).toEqual({
      exitCode: 0,
      stdout: `${JSON.stringify({ status: 200, authentication })}\n`,
      stderr: "",
    });
  },
);
