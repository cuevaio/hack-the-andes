import { ChallengeCatalogSchema } from "@chofex/challenges-contract";
import { ApiSuccessSchema } from "@chofex/registration-contract";
import {
  buildPowerGridAnnouncement,
  powerGridAnnouncementCampaign,
  powerGridAnnouncementUrl,
} from "../../apps/web/lib/emails/power-grid-announcement";
import {
  AnnouncementError,
  decode,
  digest,
} from "../slow-service-announcement/campaign";

export {
  AnnouncementError,
  parseOptions,
  planRecipients,
  retryWindowMs,
} from "../slow-service-announcement/campaign";
export const campaignId = `challenge-launch/${powerGridAnnouncementCampaign}`;
export const campaignUserId = `campaign:${powerGridAnnouncementCampaign}`;
export const campaignStage = "challenge_announcement";
export const providerKey = (email: string) =>
  `${campaignId}/${digest(email.trim().toLowerCase())}`;
export const frozenContentHash =
  "f680ac2b701c99d4a21f257c14f115fb64ce168c8a7b1d73affb55c35e0b4381";
export function snapshot() {
  const content = buildPowerGridAnnouncement();
  const contentHash = digest(JSON.stringify(content));
  if (contentHash !== frozenContentHash)
    throw new AnnouncementError(
      "Power Grid email differs from its reviewed content snapshot",
    );
  return { content, contentHash };
}
export async function verifyLiveChallenge(
  fetcher: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = fetch,
) {
  const response = await fetcher("https://hacktheandes.com/api/v1/challenges", {
    headers: { "cache-control": "no-cache" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200)
    throw new AnnouncementError("Live catalog is unavailable");
  const catalog = decode(
    ApiSuccessSchema(ChallengeCatalogSchema),
    await response.json(),
    "Live catalog",
  );
  const challenge = catalog.data.challenges.find(
    (item) => item.slug === "power-grid",
  );
  const previous = catalog.data.challenges.find(
    (item) => item.slug === "make-it-fast",
  );
  if (
    !challenge?.playable ||
    !challenge.open ||
    challenge.closed !== false ||
    challenge.challengeVersion !== "power-grid-v1"
  )
    throw new AnnouncementError(
      "Power Grid v1 must be publicly open before sending its invitation",
    );
  if (!previous?.closed || previous.open)
    throw new AnnouncementError("The third challenge must stay closed");
  const guide = await fetcher(powerGridAnnouncementUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  const visible = (await guide.text())
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  if (
    guide.status !== 200 ||
    !visible.includes("calculateBill") ||
    !visible.includes("andes challenge init --challenge power-grid")
  )
    throw new AnnouncementError(
      "The live guide does not describe the playable Power Grid challenge",
    );
}
