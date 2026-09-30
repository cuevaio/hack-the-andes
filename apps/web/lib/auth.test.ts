import { describe, expect, test } from "bun:test";

import {
  authenticateUserWithClerk,
  authenticationFailureMessage,
  isLegacyCliCredential,
  retiredClerkIssuer,
  retiredCliOAuthClientId,
  unverifiedBearerJwtClaims,
} from "./auth";

const request = new Request("http://localhost:3000/api/v1/registration", {
  headers: { authorization: "Bearer test-token" },
});

describe("registration API authentication", () => {
  test("accepts an OAuth token issued to the Chofex CLI", async () => {
    const calls: unknown[] = [];
    const clerk = {
      async authenticateRequest(_request: Request, options: unknown) {
        calls.push(options);
        return {
          isAuthenticated: true,
          toAuth: () => ({
            clientId: "cli-client",
            tokenType: "oauth_token" as const,
            userId: "user_123",
          }),
        };
      },
    };

    await expect(
      authenticateUserWithClerk(request, clerk, "cli-client", [
        "http://localhost:3000",
      ]),
    ).resolves.toEqual({
      clerkUserId: "user_123",
      tokenType: "oauth_token",
    });
    expect(calls).toEqual([{ acceptsToken: "oauth_token" }]);
  });

  test("rejects an OAuth token issued to another client", async () => {
    const clerk = {
      async authenticateRequest() {
        return {
          isAuthenticated: true,
          toAuth: () => ({
            clientId: "other-client",
            tokenType: "oauth_token" as const,
            userId: "user_123",
          }),
        };
      },
    };

    expect(
      await authenticateUserWithClerk(request, clerk, "cli-client", [
        "http://localhost:3000",
      ]),
    ).toBeNull();
  });

  test("accepts browser sessions only from configured web origins", async () => {
    const calls: unknown[] = [];
    const clerk = {
      async authenticateRequest(
        _request: Request,
        options: { acceptsToken: string },
      ) {
        calls.push(options);
        if (options.acceptsToken === "oauth_token") {
          return {
            isAuthenticated: false,
            toAuth: () => ({ tokenType: "oauth_token" as const, userId: "" }),
          };
        }
        return {
          isAuthenticated: true,
          toAuth: () => ({
            tokenType: "session_token" as const,
            userId: "user_123",
          }),
        };
      },
    };

    await expect(
      authenticateUserWithClerk(request, clerk, "cli-client", [
        "http://localhost:3000",
      ]),
    ).resolves.toEqual({
      clerkUserId: "user_123",
      tokenType: "session_token",
    });
    expect(calls).toEqual([
      { acceptsToken: "oauth_token" },
      {
        acceptsToken: "session_token",
        authorizedParties: ["http://localhost:3000"],
      },
    ]);
  });

  test("keeps browser sessions available without a CLI OAuth client", async () => {
    const calls: unknown[] = [];
    const clerk = {
      async authenticateRequest(_request: Request, options: unknown) {
        calls.push(options);
        return {
          isAuthenticated: true,
          toAuth: () => ({
            tokenType: "session_token" as const,
            userId: "user_123",
          }),
        };
      },
    };

    await expect(
      authenticateUserWithClerk(request, clerk, undefined, [
        "https://chofex.example",
      ]),
    ).resolves.toEqual({
      clerkUserId: "user_123",
      tokenType: "session_token",
    });
    expect(calls).toEqual([
      {
        acceptsToken: "session_token",
        authorizedParties: ["https://chofex.example"],
      },
    ]);
  });
});

const unsignedJwt = (payload: Record<string, unknown>): string => {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
};

describe("legacy CLI credential detection", () => {
  test("reads issuer and client id from an unverified bearer JWT", () => {
    const token = unsignedJwt({
      iss: retiredClerkIssuer,
      azp: retiredCliOAuthClientId,
    });

    expect(unverifiedBearerJwtClaims(`Bearer ${token}`)).toEqual({
      issuer: retiredClerkIssuer,
      clientId: retiredCliOAuthClientId,
    });
  });

  test("treats tokens from the retired Clerk application as a legacy CLI", () => {
    const token = unsignedJwt({
      iss: retiredClerkIssuer,
      azp: retiredCliOAuthClientId,
    });

    expect(isLegacyCliCredential(`Bearer ${token}`)).toBe(true);
  });

  test("does not treat current Clerk tokens as legacy", () => {
    const token = unsignedJwt({
      iss: "https://clerk.hacktheandes.com",
      azp: "HddO78wKpq5PFIEl",
    });

    expect(isLegacyCliCredential(`Bearer ${token}`)).toBe(false);
  });

  test("does not treat rejected browser sessions as a retired CLI", () => {
    const token = unsignedJwt({
      iss: "https://clerk.hacktheandes.com",
      azp: "https://hacktheandes.com",
    });

    expect(isLegacyCliCredential(`Bearer ${token}`)).toBe(false);
    expect(
      authenticationFailureMessage(
        new Request("https://hacktheandes.com/api/v1/me", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).toBe("Authentication failed");
  });

  test("tells participants to update the CLI when the token is from retired Clerk", () => {
    const token = unsignedJwt({
      iss: retiredClerkIssuer,
      azp: retiredCliOAuthClientId,
    });
    const request = new Request("https://hacktheandes.com/api/v1/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(authenticationFailureMessage(request)).toContain(
      "npm install --global hacktheandes-cli@latest",
    );
  });

  test("keeps the generic failure for missing or opaque credentials", () => {
    const request = new Request("https://hacktheandes.com/api/v1/me", {
      headers: { authorization: "Bearer not-a-jwt" },
    });

    expect(authenticationFailureMessage(request)).toBe("Authentication failed");
  });
});
