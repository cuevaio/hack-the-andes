import { playableChallenges } from "@chofex/challenges-contract";
import { type SQL, sql } from "@chofex/db/orm";
import { Schema } from "effect";

import type { CandidateFilters } from "@/lib/admin/candidate-filters";
import { currentPlayableChallengeVersions } from "@/lib/challenges/metrics";

export type InsightsFilters = Pick<CandidateFilters, "country" | "challenge">;

export interface InsightsDatabase {
  execute(query: SQL): PromiseLike<{ readonly rows: readonly unknown[] }>;
}

const peopleFields = {
  people: Schema.Number,
  submitted: Schema.Number,
  challengeStarted: Schema.Number,
  challengeCompleted: Schema.Number,
  approved: Schema.Number,
  rejected: Schema.Number,
};
const challengeFields = {
  slug: Schema.Literals(playableChallenges.map((challenge) => challenge.slug)),
  started: Schema.Number,
  completed: Schema.Number,
};
const countryCode = Schema.NullOr(Schema.String);
const reportSchema = Schema.Struct({
  totals: Schema.Struct(peopleFields),
  countries: Schema.Array(Schema.Struct({ ...peopleFields, countryCode })),
  challenges: Schema.Array(Schema.Struct(challengeFields)),
  countryChallenges: Schema.Array(
    Schema.Struct({ ...challengeFields, countryCode }),
  ),
});

export type AdminInsights = typeof reportSchema.Type;
export type PeopleMetrics = AdminInsights["totals"];

const peopleCounts = sql`
  count(*)::integer as people,
  count(*) filter (where submitted)::integer as submitted,
  count(*) filter (where started)::integer as "challengeStarted",
  count(*) filter (where completed)::integer as "challengeCompleted",
  count(*) filter (where status = 'accepted')::integer as approved,
  count(*) filter (where status = 'rejected')::integer as rejected
`;

export const getAdminInsights = async (
  filters: InsightsFilters,
  database?: InsightsDatabase,
): Promise<AdminInsights> => {
  const client = database ?? (await import("@chofex/db")).db;
  const versions = currentPlayableChallengeVersions();
  let currentChallenges = sql`select null::text as slug, null::text as version where false`;
  if (versions.length > 0) {
    currentChallenges = sql`values ${sql.join(
      versions.map(
        ({ slug, version }) => sql`(${slug}::text, ${version}::text)`,
      ),
      sql`, `,
    )}`;
  }
  let countryCondition = sql`true`;
  if (filters.country?.kind === "unknown") {
    countryCondition = sql`p.country_code is null`;
  } else if (filters.country?.kind === "country") {
    countryCondition = sql`p.country_code = ${filters.country.code}`;
  } else if (filters.country?.kind === "outside_peru") {
    countryCondition = sql`p.country_code <> 'PE'`;
  }
  let selectedChallenge = sql`true`;
  let cohortCondition = sql`true`;
  if (filters.challenge) {
    selectedChallenge = sql`a.challenge_slug = ${filters.challenge}`;
    cohortCondition = sql`exists (
      select 1 from activity a where a.participant_id = b.participant_id
        and ${selectedChallenge}
    )`;
  }

  const result = await client.execute(sql`
    with current_challenges(slug, version) as (${currentChallenges}),
    latest as (
      select distinct on (participant_id) participant_id, status, submitted_at
      from applications order by participant_id, created_at desc, id desc
    ),
    base as (
      select p.id as participant_id, p.country_code, a.status, a.submitted_at
      from participants p join latest a on a.participant_id = p.id
      where a.status <> 'withdrawn' and ${countryCondition}
    ),
    activity as (
      select a.participant_id, a.challenge_slug,
        bool_or(exists (
          select 1 from challenge_evaluations e where e.attempt_id = a.id
        )) as completed
      from challenge_attempts a
      join current_challenges c on c.slug = a.challenge_slug and c.version = a.challenge_version
      join base b on b.participant_id = a.participant_id
      group by a.participant_id, a.challenge_slug
    ),
    cohort as (select b.* from base b where ${cohortCondition}),
    flags as (
      select b.*, b.submitted_at is not null as submitted,
        exists (select 1 from activity a where a.participant_id = b.participant_id
          and ${selectedChallenge}) as started,
        exists (select 1 from activity a where a.participant_id = b.participant_id
          and a.completed and ${selectedChallenge}) as completed
      from cohort b
    ),
    totals as (select ${peopleCounts} from flags),
    countries as (
      select country_code as "countryCode", ${peopleCounts}
      from flags group by country_code
    ),
    cohort_activity as (
      select a.*, b.country_code from activity a
      join cohort b on b.participant_id = a.participant_id
    ),
    challenges as (
      select c.slug, count(a.participant_id)::integer as started,
        count(a.participant_id) filter (where a.completed)::integer as completed
      from current_challenges c left join cohort_activity a on a.challenge_slug = c.slug
      group by c.slug
    ),
    country_challenges as (
      select countries."countryCode", c.slug, count(a.participant_id)::integer as started,
        count(a.participant_id) filter (where a.completed)::integer as completed
      from countries cross join current_challenges c
      left join cohort_activity a on a.challenge_slug = c.slug
        and a.country_code is not distinct from countries."countryCode"
      group by countries."countryCode", c.slug
    )
    select json_build_object(
      'totals', (select row_to_json(totals) from totals),
      'countries', coalesce((select json_agg(countries order by people desc, "countryCode" nulls last) from countries), '[]'::json),
      'challenges', coalesce((select json_agg(challenges order by slug) from challenges), '[]'::json),
      'countryChallenges', coalesce((select json_agg(country_challenges order by "countryCode" nulls last, slug) from country_challenges), '[]'::json)
    ) as report
  `);
  const row = Schema.decodeUnknownSync(Schema.Struct({ report: reportSchema }))(
    result.rows[0],
  );
  return row.report;
};
