import { powerGridChallengeSlug } from "@chofex/challenges-contract/power-grid";
import { clerkClient } from "@clerk/nextjs/server";

import {
  grantsApplicationReviewAccess,
  type RoleMetadata,
} from "../admin/roles";

export const hasChallengeEarlyAccess = async (
  clerkUserId: string,
  slug: string,
  readUser: (id: string) => Promise<{
    publicMetadata: RoleMetadata;
    privateMetadata: RoleMetadata;
  }> = async (id) => (await clerkClient()).users.getUser(id),
): Promise<boolean> => {
  if (slug !== powerGridChallengeSlug) return false;
  const user = await readUser(clerkUserId);
  return (
    grantsApplicationReviewAccess(user.publicMetadata) ||
    grantsApplicationReviewAccess(user.privateMetadata)
  );
};
