export const badgeFallbackUrl = "https://hacktheandes.com";

const ONE_LINER_LIMIT = 30;

export const badgeOneLinerFor = (oneLiner: string | null): string => {
  const source = (oneLiner ?? "PARTICIPANTE").trim();
  if (source.length <= ONE_LINER_LIMIT) return source;
  const clipped = source.slice(0, ONE_LINER_LIMIT - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > 12 ? clipped.slice(0, lastSpace) : clipped}…`;
};

export interface BadgeLinkCandidates {
  readonly websiteUrl?: string | null;
  readonly githubUrl?: string | null;
  readonly tangledUrl?: string | null;
  readonly linkedInUrl?: string | null;
}

export const badgeLinkFor = (candidates: BadgeLinkCandidates): string => {
  const ordered = [
    candidates.websiteUrl,
    candidates.githubUrl,
    candidates.tangledUrl,
    candidates.linkedInUrl,
  ];
  for (const candidate of ordered) {
    const url = candidate?.trim();
    if (url) return url;
  }
  return badgeFallbackUrl;
};

export interface ChallengePlacementCandidate {
  readonly theme: string;
  readonly rank: number;
}

export const bestChallengePlacement = (
  candidates: ReadonlyArray<ChallengePlacementCandidate>,
): ChallengePlacementCandidate | undefined => {
  let best: ChallengePlacementCandidate | undefined;
  for (const candidate of candidates) {
    if (!best || candidate.rank < best.rank) best = candidate;
  }
  return best;
};

export const challengePlacementLabel = (
  placement: ChallengePlacementCandidate | undefined,
): string => {
  if (!placement) return "PARTICIPANT";
  const rank = String(placement.rank).padStart(2, "0");
  return `${placement.theme.toUpperCase()} · #${rank}`;
};

export interface BadgeApplicationProfileSource extends BadgeLinkCandidates {
  readonly name?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly role?: string | null;
  readonly pictureUrl?: string | null;
}

export interface AcceptanceBadgeProfileSource extends BadgeLinkCandidates {
  readonly role?: string;
  /** The same picture an administrator saw while making the decision. */
  readonly avatarUrl?: string;
}

export interface AcceptanceBadgeProfile {
  readonly oneLiner: string;
  readonly linkUrl: string;
  readonly pictureUrl?: string;
}

export const acceptanceBadgeProfileFor = (
  source: AcceptanceBadgeProfileSource,
): AcceptanceBadgeProfile => {
  return {
    oneLiner: badgeOneLinerFor(source.role ?? null),
    linkUrl: badgeLinkFor(source),
    pictureUrl: source.avatarUrl,
  };
};

export interface BadgeProfileOverrides {
  readonly oneLiner?: string | null;
  readonly linkUrl?: string | null;
  readonly placement?: string | null;
  readonly pictureUrl?: string | null;
  readonly portraitUrl?: string | null;
}

export interface ResolvedBadgeProfile {
  readonly fullName: string;
  readonly oneLiner: string;
  readonly linkUrl: string;
  readonly placement: string;
  readonly pictureUrl: string | null;
  readonly portraitUrl: string | null;
}

export const resolveBadgeProfile = (
  application: BadgeApplicationProfileSource,
  overrides?: BadgeProfileOverrides | null,
): ResolvedBadgeProfile => {
  const applicationName = [
    application.firstName?.trim(),
    application.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    fullName: application.name?.trim() || applicationName,
    oneLiner: badgeOneLinerFor(
      overrides?.oneLiner?.trim() || application.role?.trim() || null,
    ),
    linkUrl:
      overrides?.linkUrl?.trim() ||
      badgeLinkFor({
        websiteUrl: application.websiteUrl,
        githubUrl: application.githubUrl,
        tangledUrl: application.tangledUrl,
        linkedInUrl: application.linkedInUrl,
      }),
    placement: overrides?.placement?.trim() || "PARTICIPANT",
    pictureUrl:
      overrides?.pictureUrl?.trim() || application.pictureUrl?.trim() || null,
    portraitUrl: overrides?.portraitUrl?.trim() || null,
  };
};
