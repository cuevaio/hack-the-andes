import { and, eq } from "@chofex/db/orm";
import { participantBadges } from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { logger, task } from "@trigger.dev/sdk";
import { downloadImage } from "@/lib/badges/download-image";
import { halftonePortraitPng } from "../lib/badges/portrait-image";
import { uploadPng } from "./badge-assets";

/**
 * The participant's portrait, screened into dots.
 *
 * Replaces a call to an image model that redrew the photograph as pixel
 * art. The credential they open carries a halftone, so pixel art in the
 * image they save is the same person in two visual languages at one
 * event — and a deterministic screen cannot time out, cost anything per
 * participant, or return a face that is not theirs.
 *
 * It keeps its own task rather than folding into the composition step so
 * the retry boundary, the queue and the stored intermediate stay where
 * they were.
 */
export interface GeneratePortraitPayload {
  readonly applicationId: string;
  readonly generationId: string;
  readonly pictureUrl: string;
}

export const generatePortrait = task({
  id: "generate-portrait",
  queue: { concurrencyLimit: 3 },
  maxDuration: 120,
  run: async (payload: GeneratePortraitPayload) => {
    logger.info("Screening portrait", {
      applicationId: payload.applicationId,
    });

    const original = await downloadImage(payload.pictureUrl);
    const screened = await halftonePortraitPng(Buffer.from(original));

    const blob = await uploadPng(
      `participant-badges/${payload.applicationId}/${payload.generationId}/portrait.png`,
      // `uploadPng` speaks ArrayBuffer; sharp answers in Buffer, whose
      // own buffer may be a slice of a larger pool.
      screened.buffer.slice(
        screened.byteOffset,
        screened.byteOffset + screened.byteLength,
      ) as ArrayBuffer,
    );
    await db
      .update(participantBadges)
      .set({
        portraitUrl: blob.url,
        portraitPathname: blob.pathname,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.generationId, payload.generationId),
        ),
      );

    return { url: blob.url, pathname: blob.pathname };
  },
});
