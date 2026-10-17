import { sql } from "@chofex/db/orm";
import { Schema } from "effect";
import { eventQuery } from "@/lib/event/database";
import { creditsForCheckin } from "./catalog";

export async function getParticipantCredits(clerkUserId: string) {
  const checkedIn = Schema.decodeUnknownSync(Schema.Boolean)(
    await eventQuery(sql`select exists(
      select 1 from participants p
      join applications a on a.participant_id=p.id and a.status='accepted'
      join acceptance_details d on d.application_id=a.id
      left join hackathon_confirmed_participants c on c.application_id=a.id
      where p.clerk_user_id=${clerkUserId} and d.checked_in_at is not null
        and (c.application_id is not null or d.checkin_exception_reason is not null)
    ) as result`),
  );
  return creditsForCheckin(checkedIn);
}
