const canonicalPublicOrigin = "https://hacktheandes.com";

export const publicRequestOrigin = (request: Request): string => {
  // OAuth resources and WebAuthn links must not trust caller-controlled forwarding.
  if (process.env.NODE_ENV === "production") return canonicalPublicOrigin;
  const url = new URL(request.url);
  if (["0.0.0.0", "::", "[::]"].includes(url.hostname))
    return canonicalPublicOrigin;
  return url.origin;
};
