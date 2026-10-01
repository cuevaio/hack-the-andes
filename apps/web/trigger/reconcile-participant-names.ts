import { db } from "@chofex/db/worker";
import { createClerkClient } from "@clerk/backend";
import { logger, schedules } from "@trigger.dev/sdk";
import { reconcileParticipantNames } from "../lib/registration/name-sync";

export const reconcileNames = schedules.task({
  id: "reconcile-participant-names",
  cron: "* * * * *",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  run: async () => {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const result = await reconcileParticipantNames(db, clerk.users);
    for (const failure of result.failures) {
      logger.error("Could not synchronize participant name", failure);
    }
    return {
      synchronized: result.synchronized,
      failed: result.failures.length,
    };
  },
});
