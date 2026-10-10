import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  createRequestLimiter,
  mutationOriginAllowed,
  requestRejection,
} from "@/lib/request-security";
import { createSharedRequestLimiter } from "@/lib/shared-request-limiter";

const clerk = clerkMiddleware();
const limitRequest = createRequestLimiter();
const limitSharedRequest = createSharedRequestLimiter();

function isPublicMarketingPath(pathname: string) {
  if (/^\/challenges\/[^/]+\/approve(?:\/|$)/.test(pathname)) {
    return false;
  }
  if (
    pathname === "/" ||
    pathname === "/game" ||
    pathname === "/_next/image" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/challenges" ||
    pathname === "/credits" ||
    pathname === "/brand" ||
    pathname === "/comunal" ||
    pathname === "/api/webhooks/clerk" ||
    pathname === "/api/v1/oauth/authorize" ||
    pathname === "/opengraph-image.jpg" ||
    pathname === "/twitter-image.jpg" ||
    pathname === "/api/v1/challenges"
  ) {
    return true;
  }

  if (pathname.startsWith("/challenges/")) {
    return true;
  }

  if (/^\/api\/v1\/challenges\/[^/]+\/ranking$/.test(pathname)) {
    return true;
  }

  if (pathname.startsWith("/models/") || pathname.startsWith("/draco/")) {
    return true;
  }

  if (pathname.startsWith("/hero/") || pathname.startsWith("/brand/")) {
    return true;
  }

  // Sponsorship decks are private-by-obscurity outreach artifacts: sent as a
  // link to one company, noindex, never behind a login. A recipient has no
  // account, so routing them through Clerk would just fail the handshake.
  if (pathname.startsWith("/deck/")) {
    return true;
  }

  return (
    pathname.startsWith("/terms/") ||
    pathname.startsWith("/privacy/") ||
    pathname.startsWith("/credits/")
  );
}

export default async function proxy(...args: Parameters<typeof clerk>) {
  const request = args[0];

  if (request) {
    const retryAfter = limitRequest(request);
    if (retryAfter !== undefined)
      return requestRejection(request, 429, retryAfter);
    if (!mutationOriginAllowed(request)) return requestRejection(request, 403);
    const sharedRejection = await limitSharedRequest(request);
    if (sharedRejection) return sharedRejection;
  }

  if (request && isPublicMarketingPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return clerk(...args);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|glb|wasm)).*)",
    "/(api|trpc)(.*)",
    "/_next/image",
    "/__clerk/:path*",
  ],
};
