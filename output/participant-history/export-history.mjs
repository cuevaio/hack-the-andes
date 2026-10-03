import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEW_DATABASE_URL);
const results = await sql.transaction([
  sql`select now() as generated_at, (now() at time zone 'America/Lima')::date as today,
    (select min(created_at) from participants) as first_signup,
    (select count(*)::int from participants) as participants,
    (select count(*)::int from applications where status in ('accepted','rejected') and decided_at is null) as undated_decisions,
    (select count(*)::int from applications where status='withdrawn') as undated_withdrawals,
    (select count(*)::int from acceptance_details where completed_at is not null and first_completed_at is null) as undated_first_confirmations`,
  sql`with events as (
    select id as participant_id, 'registered' as stage, created_at as occurred_at from participants
    union all select participant_id, 'draft', created_at from applications
    union all select participant_id, 'submitted', submitted_at from applications where submitted_at is not null
    union all select participant_id, 'challenge_started', created_at from challenge_attempts
    union all select a.participant_id, 'challenge_completed', e.created_at from challenge_evaluations e join challenge_attempts a on a.id=e.attempt_id
    union all select participant_id, 'accepted', decided_at from applications where status='accepted' and decided_at is not null
    union all select participant_id, 'rejected', decided_at from applications where status='rejected' and decided_at is not null
    union all select a.participant_id, 'confirmed', d.first_completed_at from acceptance_details d join applications a on a.id=d.application_id where d.first_completed_at is not null
  ), first_events as (
    select participant_id, stage, min(occurred_at) as occurred_at from events where occurred_at <= now() group by participant_id, stage
  ), days as (
    select generate_series(
      (select min(created_at) at time zone 'America/Lima' from participants)::date,
      (now() at time zone 'America/Lima')::date,
      interval '1 day')::date as day
  )
  select day::text as date,
    count(*) filter (where stage='registered')::int as registered,
    count(*) filter (where stage='draft')::int as draft,
    count(*) filter (where stage='submitted')::int as submitted,
    count(*) filter (where stage='challenge_started')::int as challenge_started,
    count(*) filter (where stage='challenge_completed')::int as challenge_completed,
    count(*) filter (where stage='accepted')::int as accepted,
    count(*) filter (where stage='confirmed')::int as confirmed,
    count(*) filter (where stage='rejected')::int as rejected
  from days left join first_events on (occurred_at at time zone 'America/Lima')::date <= day
  group by day order by day`,
]);
const report = { metadata: results[0][0], days: results[1] };
await writeFile(
  new URL("./history.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
const columns = Object.keys(report.days[0]);
await writeFile(
  new URL("./history.csv", import.meta.url),
  `${[
    columns.join(","),
    ...report.days.map((day) => columns.map((key) => day[key]).join(",")),
  ].join("\n")}\n`,
);
console.log(
  JSON.stringify(
    {
      metadata: report.metadata,
      first: report.days[0],
      latest: report.days.at(-1),
      days: report.days.length,
    },
    null,
    2,
  ),
);
