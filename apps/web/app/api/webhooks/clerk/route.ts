import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";

import {
  configuredAdminIdsFrom,
  userGrantsApplicationReviewAccess,
} from "@/lib/admin/roles";
import { enqueueFunnelReminder } from "@/lib/funnel-reminders/enqueue";
import { HttpError, readRequestBody } from "@/lib/registration/http";
import { participantIdFor } from "@/lib/registration/participants";

export const runtime = "nodejs";

export const POST = async (request: NextRequest): Promise<Response> => {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    const body = await readRequestBody(request);
    event = await verifyWebhook(
      new NextRequest(request.url, {
        method: "POST",
        headers: request.headers,
        body,
      }),
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(error.message, {
        status: error.status,
        headers: { "cache-control": "no-store" },
      });
    }
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type !== "session.created") {
    return Response.json({ received: true });
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(event.data.user_id);
  await participantIdFor(
    user.id,
    [user.firstName, user.lastName].filter(Boolean).join(" "),
  );
  const isApplicationReviewer = userGrantsApplicationReviewAccess({
    clerkUserId: user.id,
    configuredAdminIds: configuredAdminIdsFrom(
      process.env.ADMIN_CLERK_USER_IDS,
    ),
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });
  if (isApplicationReviewer) {
    return Response.json({ received: true, scheduled: false });
  }

  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (!primaryEmail) {
    return Response.json({ received: true, scheduled: false });
  }
  await enqueueFunnelReminder({
    clerkUserId: user.id,
    stage: "registration",
    recipient: {
      email: primaryEmail.emailAddress.trim().toLowerCase(),
      firstName: user.firstName ?? "",
    },
  });
  return Response.json({ received: true });
};
