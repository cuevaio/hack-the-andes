import { isTangledProfileUrl } from "@chofex/registration-contract";

interface ParticipantName {
  readonly firstName: string;
  readonly lastName: string;
}

export const participantDisplayName = (identity: ParticipantName): string =>
  `${identity.firstName} ${identity.lastName}`.trim();

export const rankingDisplayName = (identity: {
  readonly name?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}): string => {
  const name = identity.name?.trim();
  if (name) return name;
  return participantDisplayName({
    firstName: identity.firstName ?? "Unknown",
    lastName: identity.lastName ?? "participant",
  });
};

export interface PublicProfileLinks {
  readonly tangledUrl?: string;
  readonly githubUrl?: string;
  readonly linkedInUrl?: string;
}

interface PublicProfileIdentities {
  readonly github?: string;
  readonly linkedIn?: string;
}

const publicProfileUrl = (
  value: string | null | undefined,
  hostMatches: (hostname: string) => boolean,
  pathMatches: (pathname: string) => boolean,
): URL | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      hostMatches(url.hostname.toLowerCase()) &&
      pathMatches(url.pathname)
    ) {
      return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const profilePathSegments = (pathname: string): Array<string> =>
  pathname.split("/").filter(Boolean);

const isGitHubHostname = (hostname: string): boolean =>
  hostname === "github.com" || hostname === "www.github.com";

const isLinkedInHostname = (hostname: string): boolean =>
  hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");

const isGitHubPath = (pathname: string): boolean =>
  profilePathSegments(pathname).length >= 1;

const isLinkedInProfilePath = (pathname: string): boolean => {
  const segments = profilePathSegments(pathname);
  return segments[0]?.toLowerCase() === "in" && Boolean(segments[1]);
};

export const publicProfileIdentitiesFor = (identity: {
  readonly githubUrl?: string | null;
  readonly linkedInUrl?: string | null;
}): PublicProfileIdentities => {
  const identities: { github?: string; linkedIn?: string } = {};
  const githubUrl = publicProfileUrl(
    identity.githubUrl,
    isGitHubHostname,
    isGitHubPath,
  );
  const githubSegments = githubUrl
    ? profilePathSegments(githubUrl.pathname)
    : [];
  if (githubSegments.length === 1) {
    identities.github = githubSegments[0]?.toLowerCase();
  }

  const linkedInUrl = publicProfileUrl(
    identity.linkedInUrl,
    isLinkedInHostname,
    isLinkedInProfilePath,
  );
  const linkedInSegments = linkedInUrl
    ? profilePathSegments(linkedInUrl.pathname)
    : [];
  if (linkedInSegments[1]) {
    identities.linkedIn = linkedInSegments[1].toLowerCase();
  }
  return identities;
};

export const publicProfileLinksFor = (identity: {
  readonly tangledUrl?: string | null;
  readonly githubUrl?: string | null;
  readonly linkedInUrl?: string | null;
}): PublicProfileLinks => {
  const links: {
    tangledUrl?: string;
    githubUrl?: string;
    linkedInUrl?: string;
  } = {};
  if (identity.tangledUrl && isTangledProfileUrl(identity.tangledUrl)) {
    links.tangledUrl = new URL(identity.tangledUrl).href;
  }
  const githubUrl = publicProfileUrl(
    identity.githubUrl,
    isGitHubHostname,
    isGitHubPath,
  );
  const linkedInUrl = publicProfileUrl(
    identity.linkedInUrl,
    isLinkedInHostname,
    isLinkedInProfilePath,
  );
  if (githubUrl) links.githubUrl = githubUrl.href;
  if (linkedInUrl) links.linkedInUrl = linkedInUrl.href;
  return links;
};
