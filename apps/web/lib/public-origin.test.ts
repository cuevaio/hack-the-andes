import { expect, test } from "bun:test";

import { publicRequestOrigin } from "./public-origin";

test("uses the canonical public origin for the container bind address", () => {
  const request = new Request("https://0.0.0.0:3000/api/v1/me", {
    headers: {
      "x-forwarded-host": "hacktheandes.com",
      "x-forwarded-proto": "https",
    },
  });

  expect(publicRequestOrigin(request)).toBe("https://hacktheandes.com");
});

test("does not advertise the container bind address as an OAuth resource", () => {
  const request = new Request("https://0.0.0.0:3000/api/v1/me");

  expect(publicRequestOrigin(request)).toBe("https://hacktheandes.com");
});

test("does not advertise an IPv6 bind address from forwarded hosts", () => {
  const bracketed = new Request("https://0.0.0.0:3000/api/v1/me", {
    headers: {
      "x-forwarded-host": "[::]:3000",
      "x-forwarded-proto": "https",
    },
  });
  const unbracketed = new Request("https://[::]:3000/api/v1/me", {
    headers: {
      "x-forwarded-host": "::",
      "x-forwarded-proto": "https",
    },
  });

  expect(publicRequestOrigin(bracketed)).toBe("https://hacktheandes.com");
  expect(publicRequestOrigin(unbracketed)).toBe("https://hacktheandes.com");
});

test("keeps explicit public request origins", () => {
  const request = new Request("https://hack.example/api/v1/me");

  expect(publicRequestOrigin(request)).toBe("https://hack.example");
});

test("ignores forged forwarding headers in OAuth and WebAuthn origins", () => {
  const request = new Request("https://hacktheandes.com/api/v1/me", {
    headers: {
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "javascript",
    },
  });
  expect(publicRequestOrigin(request)).toBe("https://hacktheandes.com");
});

test("pins production origins even when the incoming Host changes", () => {
  const child = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
    import { publicRequestOrigin } from "./public-origin";
    console.log(publicRequestOrigin(new Request("https://attacker.example/api/v1/me")));
  `,
    ],
    { cwd: import.meta.dir, env: { ...process.env, NODE_ENV: "production" } },
  );
  expect(child.exitCode).toBe(0);
  expect(child.stdout.toString().trim()).toBe("https://hacktheandes.com");
});
