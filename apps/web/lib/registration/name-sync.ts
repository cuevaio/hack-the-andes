import { and, asc, eq, isNotNull, lt } from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";
import type { ParticipantDatabase } from "./participants";

interface ClerkNames {
  getUser(
    userId: string,
  ): Promise<{ firstName: string | null; lastName: string | null }>;
  updateUser(
    userId: string,
    names: { firstName: string; lastName: string },
  ): Promise<unknown>;
}

export const reconcileParticipantNames = async (
  database: ParticipantDatabase,
  clerk: ClerkNames,
  now = new Date(),
) => {
  const due = await database
    .select({
      id: participants.id,
      clerkUserId: participants.clerkUserId,
    })
    .from(participants)
    .where(
      and(isNotNull(participants.name), lt(participants.nameSyncAfter, now)),
    )
    .orderBy(asc(participants.nameSyncAfter), asc(participants.id))
    .limit(100);
  const failures: Array<{ participantId: string; error: unknown }> = [];
  let synchronized = 0;
  for (const candidate of due) {
    const [participant] = await database
      .select({
        name: participants.name,
        token: participants.nameSyncToken,
      })
      .from(participants)
      .where(eq(participants.id, candidate.id));
    if (!participant?.name) continue;
    let nextCheck = new Date(now.getTime() + 60 * 60 * 1_000);
    try {
      const user = await clerk.getUser(candidate.clerkUserId);
      const clerkName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (clerkName !== participant.name) {
        await clerk.updateUser(candidate.clerkUserId, {
          firstName: participant.name,
          lastName: "",
        });
      }
      synchronized += 1;
    } catch (error) {
      failures.push({ participantId: candidate.id, error });
      nextCheck = new Date(now.getTime() + 5 * 60 * 1_000);
    }
    await database
      .update(participants)
      .set({ nameSyncAfter: nextCheck })
      .where(
        and(
          eq(participants.id, candidate.id),
          eq(participants.nameSyncToken, participant.token),
        ),
      );
  }
  return { synchronized, failures };
};
