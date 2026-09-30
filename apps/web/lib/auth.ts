import { clerkClient } from "@clerk/nextjs/server";

import {
  configuredAdminIdsFrom,
  userGrantsApplicationReviewAccess,
} from "./admin/roles";
import { HttpError } from "./registration/http";

export const retiredCliOAuthClientId = "1YfuXKgOXkdH094s";
export const retiredClerkIssuer = "https://close-newt-8265.clerk.accounts.dev";

export const legacyCliAuthenticationMessage =
  "Este CLI inició sesión en una aplicación de Clerk retirada. Actualiza con `npm install --global hacktheandes-cli@latest`, luego ejecuta `andes logout` y `andes login`.";

const normalizeIssuer = (value: string): string => value.replace(/\/+$/, "");

const decodeBase64UrlJson = (value: string): unknown => {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return JSON.parse(atob(`${padded}${pad}`)) as unknown;
  } catch {
    return undefined;
  }
};

export const unverifiedBearerJwtClaims = (
  authorization: string | null,
): { readonly issuer?: string; readonly clientId?: string } | undefined => {
  if (!authorization) return;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) return;
  const token = match[1] ?? "";
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return;
  const payload = decodeBase64UrlJson(payloadSegment);
  if (!payload || typeof payload !== "object") return;

  const record = payload as Record<string, unknown>;
  let issuer: string | undefined;
  if (typeof record.iss === "string" && record.iss.length > 0) {
    issuer = record.iss;
  }
  let clientId: string | undefined;
  if (typeof record.azp === "string" && record.azp.length > 0) {
    clientId = record.azp;
  } else if (
    typeof record.client_id === "string" &&
    record.client_id.length > 0
  ) {
    clientId = record.client_id;
  }
  if (!issuer && !clientId) return;
  return { issuer, clientId };
};

export const isLegacyCliCredential = (
  authorization: string | null,
): boolean => {
  const claims = unverifiedBearerJwtClaims(authorization);
  if (!claims) return false;
  if (claims.clientId) {
    if (
      claims.clientId.startsWith("http://") ||
      claims.clientId.startsWith("https://")
    ) {
      return false;
    }
    return claims.clientId === retiredCliOAuthClientId;
  }
  if (!claims.issuer) return false;
  return normalizeIssuer(claims.issuer) === normalizeIssuer(retiredClerkIssuer);
};

export const authenticationFailureMessage = (request: Request): string => {
  if (isLegacyCliCredential(request.headers.get("authorization"))) {
    return legacyCliAuthenticationMessage;
  }
  return "Authentication failed";
};

export interface AuthenticatedParticipant {
  readonly clerkUserId: string;
  readonly tokenType: "oauth_token" | "session_token";
}

export interface AuthenticatedParticipantProfile
  extends AuthenticatedParticipant {
  readonly email: string;
  readonly firstName: string;
  readonly name: string;
  readonly canReviewApplications: boolean;
  readonly clerkPictureUrl?: string;
}

interface ClerkAuthenticationState {
  readonly isAuthenticated: boolean;
  readonly toAuth: () => {
    readonly tokenType: string | null;
    readonly userId?: string | null;
    readonly clientId?: string | null;
  };
}

interface ClerkRequestAuthenticator {
  authenticateRequest(
    request: Request,
    options: {
      readonly acceptsToken: "oauth_token" | "session_token";
      readonly authorizedParties?: ReadonlyArray<string>;
    },
  ): Promise<ClerkAuthenticationState>;
}

export const authenticateUserWithClerk = async (
  request: Request,
  clerk: ClerkRequestAuthenticator,
  cliOAuthClientId: string | undefined,
  authorizedWebOrigins: ReadonlyArray<string>,
): Promise<AuthenticatedParticipant | null> => {
  if (cliOAuthClientId) {
    const oauthState = await clerk.authenticateRequest(request, {
      acceptsToken: "oauth_token",
    });
    if (oauthState.isAuthenticated) {
      const oauth = oauthState.toAuth();
      if (
        oauth.tokenType === "oauth_token" &&
        oauth.clientId === cliOAuthClientId &&
        oauth.userId
      ) {
        return { clerkUserId: oauth.userId, tokenType: "oauth_token" };
      }
      return null;
    }
  }

  const sessionState = await clerk.authenticateRequest(request, {
    acceptsToken: "session_token",
    authorizedParties: authorizedWebOrigins,
  });
  if (!sessionState.isAuthenticated) return null;
  const session = sessionState.toAuth();
  if (session.tokenType !== "session_token" || !session.userId) return null;
  return { clerkUserId: session.userId, tokenType: "session_token" };
};

export const authenticateParticipant = async (
  request: Request,
): Promise<AuthenticatedParticipant | null> => {
  const clientId = process.env.CLERK_CLI_OAUTH_CLIENT_ID;
  const authorizedParties =
    process.env.CLERK_AUTHORIZED_PARTIES ?? "http://localhost:3000";
  const configuredOrigins = authorizedParties
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configuredOrigins.length === 0) {
    configuredOrigins.push("http://localhost:3000");
  }
  return authenticateUserWithClerk(
    request,
    (await clerkClient()) as ClerkRequestAuthenticator,
    clientId,
    configuredOrigins,
  );
};

export const requireAuthenticatedParticipant = async (
  request: Request,
): Promise<AuthenticatedParticipant> => {
  const authentication = await authenticateParticipant(request);
  if (!authentication) {
    throw new HttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      authenticationFailureMessage(request),
    );
  }
  return authentication;
};

export const requireAuthenticatedParticipantProfile = async (
  request: Request,
): Promise<AuthenticatedParticipantProfile> => {
  const authentication = await requireAuthenticatedParticipant(request);
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(authentication.clerkUserId);
  const emailAddress = user.emailAddresses.find(
    (candidate) => candidate.id === user.primaryEmailAddressId,
  );
  if (!emailAddress) {
    throw new HttpError(
      422,
      "PRIMARY_EMAIL_REQUIRED",
      "The authenticated Clerk user does not have a primary email address",
    );
  }
  return {
    ...authentication,
    email: emailAddress.emailAddress.trim().toLowerCase(),
    firstName: user.firstName ?? "",
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    canReviewApplications: userGrantsApplicationReviewAccess({
      clerkUserId: authentication.clerkUserId,
      configuredAdminIds: configuredAdminIdsFrom(
        process.env.ADMIN_CLERK_USER_IDS,
      ),
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
    }),
    clerkPictureUrl: user.hasImage ? user.imageUrl : undefined,
  };
};

export const requireBrowserParticipantProfile = async (
  request: Request,
): Promise<AuthenticatedParticipantProfile> => {
  const participant = await requireAuthenticatedParticipantProfile(request);
  if (participant.tokenType !== "session_token") {
    throw new HttpError(
      403,
      "BROWSER_SESSION_REQUIRED",
      "This action must be completed by the participant in an authenticated browser session",
    );
  }
  return participant;
};

export const requireParticipantUserId = async (
  request: Request,
): Promise<string> => {
  const authentication = await requireAuthenticatedParticipant(request);
  return authentication.clerkUserId;
};
