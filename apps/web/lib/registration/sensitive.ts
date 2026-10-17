import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const encryptSensitiveValue = (
  value: string,
  base64Key: string,
): string => {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("Encryption key must decode to exactly 32 bytes");
  }
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    initializationVector.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
};

export const decryptSensitiveValue = (
  value: string,
  base64Key: string,
): string => {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32)
    throw new Error("Encryption key must decode to exactly 32 bytes");
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (
    version !== "v1" ||
    !iv ||
    !tag ||
    ciphertext === undefined ||
    extra !== undefined ||
    ![iv, tag, ciphertext].every((part) => /^[A-Za-z0-9_-]*$/.test(part))
  )
    throw new Error("Invalid encrypted participant value");
  const initializationVector = Buffer.from(iv, "base64url");
  const authTag = Buffer.from(tag, "base64url");
  if (initializationVector.length !== 12 || authTag.length !== 16)
    throw new Error("Invalid encrypted participant value");
  const decipher = createDecipheriv("aes-256-gcm", key, initializationVector);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
