import { describe, expect, test } from "bun:test";

import {
  assertAuthorizationClient,
  assertInteractiveLogin,
  bridgedAuthorizationUrl,
  browserCommand,
  createPkce,
  macOSCredentialSaveArgs,
  pkceChallenge,
  revocationToken,
  tokenEndpointError,
} from "../src/auth.js";

describe("CLI authentication", () => {
  test("creates an RFC 7636 S256 PKCE challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );

    const first = createPkce();
    const second = createPkce();
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(first.challenge).toBe(pkceChallenge(first.verifier));
    expect(first.verifier).not.toBe(second.verifier);
  });

  test("passes serialized credentials to the macOS keychain without prompting", () => {
    expect(macOSCredentialSaveArgs("serialized-credential")).toEqual([
      "add-generic-password",
      "-U",
      "-a",
      "credentials",
      "-s",
      "run.chofex.cli.oauth",
      "-w",
      "serialized-credential",
    ]);
  });

  test("opens OAuth URLs directly on every supported platform", () => {
    const url =
      "https://close-newt-8265.clerk.accounts.dev/oauth/authorize?response_type=code&client_id=1YfuXKgOXkdH094s&state=test";
    expect(browserCommand(url, "darwin")).toEqual(["open", [url]]);
    expect(browserCommand(url, "linux")).toEqual(["xdg-open", [url]]);
    expect(browserCommand(url, "win32")).toEqual([
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", url],
    ]);
  });

  test("starts browser authorization on the first-party attribution bridge", () => {
    const clerk =
      "https://clerk.example.com/oauth/authorize?response_type=code&client_id=cli&state=nonce";
    expect(
      bridgedAuthorizationUrl(
        "https://hacktheandes.com/api/v1/oauth/authorize",
        clerk,
      ),
    ).toBe(
      "https://hacktheandes.com/api/v1/oauth/authorize?response_type=code&client_id=cli&state=nonce",
    );
  });

  test("revokes a refresh token instead of only the access token", () => {
    expect(
      revocationToken({ accessToken: "access", refreshToken: "refresh" }),
    ).toBe("refresh");
    expect(revocationToken({ accessToken: "access" })).toBe("access");
  });

  test("requires a terminal that can keep the OAuth callback alive", () => {
    expect(() => assertInteractiveLogin(false)).toThrow(
      "OAuth login requires an interactive terminal. Run `andes login` yourself in a local terminal and leave it open until the browser confirms login.",
    );
    expect(() => assertInteractiveLogin(true)).not.toThrow();
  });

  test("rejects an unknown OAuth client before opening a browser", async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: {
        location:
          "https://close-newt-8265.clerk.accounts.dev/oauth/authorize/continue?client_id=gone",
      },
    });
    const fetchImpl = (async (input: string | URL) => {
      if (!String(input).includes("continue")) return redirect;
      return Response.json(
        {
          error: "invalid_client",
          error_description: "The requested OAuth 2.0 Client does not exist.",
        },
        { status: 401 },
      );
    }) as unknown as typeof fetch;

    await expect(
      assertAuthorizationClient(
        "https://close-newt-8265.clerk.accounts.dev/oauth/authorize?client_id=gone",
        fetchImpl,
      ),
    ).rejects.toThrow("Chofex OAuth client is unavailable");
  });

  test("does not block login when the OAuth issuer is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      assertAuthorizationClient(
        "https://close-newt-8265.clerk.accounts.dev/oauth/authorize",
        fetchImpl,
      ),
    ).resolves.toBeUndefined();
  });

  test("makes a token-exchange client error actionable", () => {
    expect(
      tokenEndpointError(401, {
        error: "invalid_client",
        error_description: "The requested OAuth 2.0 Client does not exist.",
      }).message,
    ).toContain("Chofex OAuth client is unavailable");
  });
});
