import { sql } from "@chofex/db/orm";
import { Schema } from "effect";

import { currentPlayableChallengeVersions } from "@/lib/challenges/metrics";
import { type HistoryQuery, limaDay } from "./history-query";
import type { InsightsDatabase } from "./insights";

const stageSchema = Schema.Literals([
  "registered",
  "draft",
  "submitted",
  "challenge_started",
  "challenge_completed",
  "accepted",
  "confirmed",
  "rejected",
  "withdrawn",
  "unknown",
]);
export const historyStages = stageSchema.literals;
export type HistoryStage = typeof stageSchema.Type;
const attendanceSchema = Schema.Struct({
  onSiteAccepted: Schema.Number,
  onSiteConfirmed: Schema.Number,
  onSiteAwaitingConfirmation: Schema.Number,
  remoteAccepted: Schema.Number,
  unknownModeAccepted: Schema.Number,
  recordedCheckIns: Schema.Number,
  reviewReady: Schema.Number,
  needsChallenge: Schema.Number,
  drafts: Schema.Number,
  firstConfirmationsLast7Days: Schema.Number,
  confirmationTimingUnknown: Schema.Number,
  missingDecisionDates: Schema.Number,
});
const reportSchema = Schema.Struct({
  generatedAt: Schema.String,
  days: Schema.Array(
    Schema.Struct({
      date: Schema.String,
      partial: Schema.Boolean,
      people: Schema.Number,
      stages: Schema.Record(stageSchema, Schema.Number),
    }),
  ),
  current: attendanceSchema,
});
export type ParticipantHistory = typeof reportSchema.Type;
export type AttendanceCounts = typeof attendanceSchema.Type;

const timestamp = Schema.NullOr(Schema.String);
const applicationSchema = Schema.Struct({
  created: Schema.String,
  status: Schema.Literals([
    "draft",
    "submitted",
    "under_review",
    "waitlisted",
    "accepted",
    "rejected",
    "withdrawn",
  ]),
  mode: Schema.NullOr(Schema.Literals(["in_person", "remote"])),
  submitted: timestamp,
  decided: timestamp,
  completed: timestamp,
  first: timestamp,
  checkedIn: timestamp,
  valid: Schema.Boolean,
});
const personSchema = Schema.Struct({
  created: Schema.String,
  country: Schema.NullOr(Schema.String),
  applications: Schema.Array(applicationSchema),
  attempts: Schema.Array(
    Schema.Struct({
      slug: Schema.String,
      created: Schema.String,
      evaluated: timestamp,
      ranked: Schema.Boolean,
    }),
  ),
});
type Person = typeof personSchema.Type;
const dayMs = 86_400_000;
const before = (time: string | null, cutoff: number): boolean =>
  time !== null && Date.parse(time) < cutoff;
const latest = (person: Person, cutoff: number) =>
  person.applications.find((app) => before(app.created, cutoff));

function stageAt(
  person: Person,
  cutoff: number,
  current: boolean,
  challenge?: HistoryQuery["challenge"],
): HistoryStage {
  const app = latest(person, cutoff);
  if (!app) return "registered";
  if (app.status === "draft") return "draft";
  if (app.status === "withdrawn") return current ? "withdrawn" : "unknown";
  if (
    app.decided &&
    (Date.parse(app.decided) < Date.parse(app.created) ||
      (app.submitted && Date.parse(app.decided) < Date.parse(app.submitted)))
  )
    return "unknown";
  const terminal = app.status === "accepted" || app.status === "rejected";
  const decided =
    before(app.decided, cutoff) || (current && app.decided === null);
  if (terminal && decided) {
    if (app.status === "rejected") return "rejected";
    const confirmedAt = app.first ?? app.completed;
    if (
      confirmedAt &&
      app.decided &&
      Date.parse(confirmedAt) < Date.parse(app.decided)
    )
      return "unknown";
    if (before(confirmedAt, cutoff)) return "confirmed";
    if (!current && app.completed && !app.first) return "unknown";
    return "accepted";
  }
  if (
    app.status === "accepted" &&
    app.decided === null &&
    before(app.first ?? app.completed, cutoff)
  )
    return "confirmed";
  if (app.submitted && !before(app.submitted, cutoff)) return "draft";
  if (terminal && app.decided === null) return "unknown";
  if (!app.submitted) return "unknown";
  const attempts = person.attempts.filter(
    (attempt) =>
      (!challenge || attempt.slug === challenge) &&
      before(attempt.created, cutoff),
  );
  if (attempts.some((attempt) => before(attempt.evaluated, cutoff)))
    return "challenge_completed";
  if (attempts.length) return "challenge_started";
  return "submitted";
}

function currentCounts(
  people: readonly Person[],
  now: number,
): AttendanceCounts {
  const counts = {
    onSiteAccepted: 0,
    onSiteConfirmed: 0,
    onSiteAwaitingConfirmation: 0,
    remoteAccepted: 0,
    unknownModeAccepted: 0,
    recordedCheckIns: 0,
    reviewReady: 0,
    needsChallenge: 0,
    drafts: 0,
    firstConfirmationsLast7Days: 0,
    confirmationTimingUnknown: 0,
    missingDecisionDates: 0,
  };
  const today = Date.parse(`${limaDay(new Date(now))}T00:00:00-05:00`);
  for (const person of people) {
    const app = latest(person, now);
    if (!app) continue;
    const terminal = app.status === "accepted" || app.status === "rejected";
    if (terminal && !app.decided) counts.missingDecisionDates++;
    if (
      app.status === "accepted" &&
      (!app.decided || before(app.decided, now))
    ) {
      if (app.mode === "remote") counts.remoteAccepted++;
      else if (app.mode === null) counts.unknownModeAccepted++;
      else {
        counts.onSiteAccepted++;
        if (app.valid && before(app.completed, now)) {
          counts.onSiteConfirmed++;
          if (!app.first) counts.confirmationTimingUnknown++;
          else if (
            Date.parse(app.first) >= today - 7 * dayMs &&
            before(app.first, today)
          )
            counts.firstConfirmationsLast7Days++;
        } else counts.onSiteAwaitingConfirmation++;
        if (before(app.checkedIn, now)) counts.recordedCheckIns++;
      }
    }
    if (app.mode !== "in_person") continue;
    if (app.status === "draft") counts.drafts++;
    if (
      ["submitted", "under_review", "waitlisted"].includes(app.status) &&
      (!app.submitted || before(app.submitted, now))
    ) {
      if (person.attempts.some((attempt) => attempt.ranked))
        counts.reviewReady++;
      else counts.needsChallenge++;
    }
  }
  return counts;
}

export async function getParticipantHistory(
  query: HistoryQuery,
  database?: InsightsDatabase,
): Promise<ParticipantHistory> {
  const client = database ?? (await import("@chofex/db")).db;
  const versions = currentPlayableChallengeVersions();
  let currentChallenges = sql`select null::text as slug, null::text as version where false`;
  if (versions.length)
    currentChallenges = sql`values ${sql.join(
      versions.map(
        ({ slug, version }) => sql`(${slug}::text, ${version}::text)`,
      ),
      sql`, `,
    )}`;
  const result = await client.execute(sql`
    with current_challenges(slug, version) as (${currentChallenges}),
    activity as (
      select a.participant_id, a.challenge_slug as slug, a.created_at as created,
        (select min(e.created_at) from challenge_evaluations e
          where e.attempt_id = a.id and e.created_at >= a.created_at
            and e.created_at < ${query.now}::timestamptz) as evaluated,
        a.best_evaluation_id is not null and exists (
          select 1 from challenge_evaluations e where e.id = a.best_evaluation_id
            and e.attempt_id = a.id and e.created_at >= a.created_at
            and e.created_at < ${query.now}::timestamptz
        ) as ranked
      from challenge_attempts a
      join current_challenges c on c.slug = a.challenge_slug and c.version = a.challenge_version
      where a.created_at < ${query.now}::timestamptz
    )
    select p.created_at::text as created, p.country_code as country,
      coalesce((select json_agg(json_build_object(
        'created', a.created_at, 'status', a.status, 'mode', a.participation_mode,
        'submitted', a.submitted_at, 'decided', a.decided_at,
        'completed', case when d.completed_at < ${query.now}::timestamptz then d.completed_at end,
        'first', case when d.first_completed_at < ${query.now}::timestamptz then d.first_completed_at end,
        'checkedIn', d.checked_in_at,
        'valid', coalesce(p.legal_name <> '' and d.date_of_birth is not null
          and d.national_id_number <> '' and d.emergency_contact_name <> ''
          and d.emergency_contact_phone <> '' and a.picture_url <> ''
          and (a.participation_mode <> 'in_person' or d.shirt_size is not null), false)
      ) order by a.created_at desc, a.id desc)
        from applications a left join acceptance_details d on d.application_id = a.id
        where a.participant_id = p.id and a.created_at < ${query.now}::timestamptz), '[]'::json) as applications,
      coalesce((select json_agg(json_build_object('slug', t.slug, 'created', t.created,
        'evaluated', t.evaluated, 'ranked', t.ranked)) from activity t
        where t.participant_id = p.id), '[]'::json) as attempts
    from participants p where p.created_at < ${query.now}::timestamptz
  `);
  const people = Schema.decodeUnknownSync(Schema.Array(personSchema))(
    result.rows,
  );
  const now = Date.parse(query.now);
  const cohort = people.filter((person) => {
    if (query.country?.kind === "unknown" && person.country !== null)
      return false;
    if (
      query.country?.kind === "outside_peru" &&
      (person.country === null || person.country === "PE")
    )
      return false;
    if (
      query.country?.kind === "country" &&
      person.country !== query.country.code
    )
      return false;
    return (
      !query.challenge ||
      person.attempts.some((attempt) => attempt.slug === query.challenge)
    );
  });
  const end = Date.parse(`${query.end}T00:00:00-05:00`);
  const days = Array.from({ length: query.days }, (_, index) => {
    const start = end - (query.days - index - 1) * dayMs;
    const cutoff = Math.min(start + dayMs, now);
    const partial = now < start + dayMs;
    const stages: Record<HistoryStage, number> = {
      registered: 0,
      draft: 0,
      submitted: 0,
      challenge_started: 0,
      challenge_completed: 0,
      accepted: 0,
      confirmed: 0,
      rejected: 0,
      withdrawn: 0,
      unknown: 0,
    };
    let people = 0;
    for (const person of cohort) {
      if (!before(person.created, cutoff)) continue;
      stages[stageAt(person, cutoff, partial, query.challenge)]++;
      people++;
    }
    return { date: limaDay(new Date(start)), partial, people, stages };
  });
  return { generatedAt: query.now, days, current: currentCounts(people, now) };
}
