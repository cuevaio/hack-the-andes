import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

import { decryptSensitiveValue, encryptSensitiveValue } from "./sensitive";

describe("sensitive participant data", () => {
  test("encrypts national IDs with randomized authenticated encryption", () => {
    const key = randomBytes(32).toString("base64");
    const first = encryptSensitiveValue("passport-123", key);
    const second = encryptSensitiveValue("passport-123", key);

    expect(first).toStartWith("v1:");
    expect(first).not.toContain("passport-123");
    expect(first).not.toBe(second);
  });

  test("rejects incorrectly sized keys", () => {
    expect(() => encryptSensitiveValue("secret", "bad-key")).toThrow(
      "Encryption key must decode to exactly 32 bytes",
    );
  });
});

test("decrypts authenticated stored documents and rejects a wrong key or altered ciphertext", () => {
  const key = Buffer.alloc(32, 3).toString("base64");
  const encrypted = encryptSensitiveValue("AB-12345678", key);
  expect(decryptSensitiveValue(encrypted, key)).toBe("AB-12345678");
  expect(() =>
    decryptSensitiveValue(encrypted, Buffer.alloc(32, 4).toString("base64")),
  ).toThrow();
  const parts = encrypted.split(":");
  const body = parts[3];
  if (!body) throw new Error("Missing fixture ciphertext");
  parts[3] = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}`;
  expect(() => decryptSensitiveValue(parts.join(":"), key)).toThrow();
  expect(() => decryptSensitiveValue("12345678", key)).toThrow(
    "Invalid encrypted participant value",
  );
});
