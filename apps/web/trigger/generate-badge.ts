import { and, eq } from "@chofex/db/orm";
import { participantBadges } from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { task } from "@trigger.dev/sdk";
import { downloadImage } from "@/lib/badges/download-image";
import { renderShareBadge } from "../lib/badges/share-image";
import { uploadPng } from "./badge-assets";

export interface GenerateBadgePayload {
  readonly applicationId: string;
  readonly generationId: string;
  readonly fullName: string;
  readonly oneLiner: string;
  readonly placement: string;
  readonly linkUrl: string;
  readonly portraitUrl?: string;
}

export const generateBadge = task({
  id: "generate-badge",
  queue: { concurrencyLimit: 5 },
  maxDuration: 300,
  run: async (payload: GenerateBadgePayload) => {
    /*
      Handed to the renderer as bytes rather than as a URL.

      The portrait was uploaded moments ago by the task before this one,
      and a renderer that fetched it would be reading a blob store that
      has not necessarily made it visible yet — a race that fails as a
      badge with an empty window, which nobody would think to look for.
    */
    let portrait: string | null = null;
    if (payload.portraitUrl) {
      const source = await downloadImage(payload.portraitUrl);
      portrait = `data:image/png;base64,${Buffer.from(source).toString("base64")}`;
    }

    const badge = await renderShareBadge({
      fullName: payload.fullName,
      oneLiner: payload.oneLiner,
      placement: payload.placement,
      linkUrl: payload.linkUrl,
      portrait,
    });
    const blob = await uploadPng(
      `participant-badges/${payload.applicationId}/${payload.generationId}/badge.png`,
      new Uint8Array(badge).buffer,
    );
    await db
      .update(participantBadges)
      .set({
        badgeUrl: blob.url,
        badgePathname: blob.pathname,
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
