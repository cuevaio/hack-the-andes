import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "@chofex/db/orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ParticipantInsights } from "@/components/participant-insights";
import { currentChallengeVersionFor } from "@/lib/challenges/engine";
import {
  completedChallengeParticipantCondition,
  startedChallengeParticipantCondition,
} from "@/lib/challenges/metrics";
import { getAdminInsights, type InsightsDatabase } from "./insights";

describe("participant insights", () => {
  let client: PGlite;
  let database: InsightsDatabase;

  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client);
    await client.exec(`
      create table participants (id text primary key, country_code text);
      create table applications (
        id text primary key, participant_id text not null references participants(id),
        status text not null, created_at timestamptz not null, submitted_at timestamptz
      );
      create table challenge_attempts (
        id text primary key, participant_id text not null references participants(id),
        challenge_slug text not null, challenge_version text not null,
        queries_used integer not null default 0, evaluations_used integer not null default 0
      );
      create table challenge_evaluations (
        id text primary key, attempt_id text not null references challenge_attempts(id)
      );
      insert into participants values
        ('A', 'PE'), ('B', 'PE'), ('C', 'CO'), ('D', null),
        ('E', null), ('F', 'CO'), ('G', 'PE'), ('H', 'PE');
      insert into applications values
        ('a1', 'A', 'rejected', '2026-09-01', '2026-09-01'),
        ('a2', 'A', 'submitted', '2026-09-02', '2026-09-02'),
        ('b1', 'B', 'rejected', '2026-09-01', '2026-09-01'),
        ('c1', 'C', 'accepted', '2026-09-01', '2026-09-01'),
        ('d1', 'D', 'submitted', '2026-09-01', '2026-09-01'),
        ('e1', 'E', 'rejected', '2026-09-01', '2026-09-01'),
        ('e2', 'E', 'draft', '2026-09-02', null),
        ('f1', 'F', 'submitted', '2026-09-01', '2026-09-01'),
        ('f2', 'F', 'withdrawn', '2026-09-02', '2026-09-01'),
        ('g1', 'G', 'submitted', '2026-09-01', '2026-09-01');
    `);
    await client.query(
      `
      insert into challenge_attempts (id, participant_id, challenge_slug, challenge_version) values
        ('a-black', 'A', 'black-box', $1), ('a-broken', 'A', 'broken-agent', $2),
        ('c-old', 'C', 'black-box', 'obsolete-version'),
        ('d-broken', 'D', 'broken-agent', $2), ('e-black', 'E', 'black-box', $1),
        ('f-black', 'F', 'black-box', $1), ('g-black', 'G', 'black-box', $1),
        ('h-black', 'H', 'black-box', $1)
    `,
      [
        currentChallengeVersionFor("black-box"),
        currentChallengeVersionFor("broken-agent"),
      ],
    );
    await client.exec(`
      insert into challenge_evaluations values
        ('a-eval-1', 'a-black'), ('a-eval-2', 'a-black'), ('c-eval', 'c-old'),
        ('d-eval', 'd-broken'), ('e-eval', 'e-black'), ('f-eval', 'f-black'), ('h-eval', 'h-black');
    `);
  });

  test("groups known countries outside Peru without absorbing unknown residence", async () => {
    await client.exec(
      "insert into participants values ('I', 'CL'); insert into applications values ('i1', 'I', 'submitted', '2026-09-01', '2026-09-01')",
    );
    const report = await getAdminInsights(
      { country: { kind: "outside_peru" } },
      database,
    );
    expect(report.totals).toEqual({
      people: 2,
      submitted: 2,
      challengeStarted: 0,
      challengeCompleted: 0,
      approved: 1,
      rejected: 0,
    });
    expect(report.countries.map((country) => country.countryCode)).toEqual([
      "CL",
      "CO",
    ]);
  });

  afterEach(async () => {
    await client.close();
  });

  test("counts unique people and actual independent milestones from the latest application", async () => {
    expect(await getAdminInsights({}, database)).toEqual({
      totals: {
        people: 6,
        submitted: 5,
        challengeStarted: 4,
        challengeCompleted: 3,
        approved: 1,
        rejected: 1,
      },
      countries: [
        {
          countryCode: "PE",
          people: 3,
          submitted: 3,
          challengeStarted: 2,
          challengeCompleted: 1,
          approved: 0,
          rejected: 1,
        },
        {
          countryCode: null,
          people: 2,
          submitted: 1,
          challengeStarted: 2,
          challengeCompleted: 2,
          approved: 0,
          rejected: 0,
        },
        {
          countryCode: "CO",
          people: 1,
          submitted: 1,
          challengeStarted: 0,
          challengeCompleted: 0,
          approved: 1,
          rejected: 0,
        },
      ],
      challenges: [
        { slug: "black-box", started: 3, completed: 2 },
        { slug: "broken-agent", started: 2, completed: 1 },
        { slug: "make-it-fast", started: 0, completed: 0 },
        { slug: "power-grid", started: 0, completed: 0 },
      ],
      countryChallenges: [
        { countryCode: "CO", slug: "black-box", started: 0, completed: 0 },
        { countryCode: "CO", slug: "broken-agent", started: 0, completed: 0 },
        { countryCode: "CO", slug: "make-it-fast", started: 0, completed: 0 },
        { countryCode: "CO", slug: "power-grid", started: 0, completed: 0 },
        { countryCode: "PE", slug: "black-box", started: 2, completed: 1 },
        { countryCode: "PE", slug: "broken-agent", started: 1, completed: 0 },
        { countryCode: "PE", slug: "make-it-fast", started: 0, completed: 0 },
        { countryCode: "PE", slug: "power-grid", started: 0, completed: 0 },
        { countryCode: null, slug: "black-box", started: 1, completed: 1 },
        { countryCode: null, slug: "broken-agent", started: 1, completed: 1 },
        { countryCode: null, slug: "make-it-fast", started: 0, completed: 0 },
        { countryCode: null, slug: "power-grid", started: 0, completed: 0 },
      ],
    });
  });

  test("filters country and current started cohort while retaining cross-participation", async () => {
    expect(
      await getAdminInsights(
        { country: { kind: "country", code: "PE" }, challenge: "black-box" },
        database,
      ),
    ).toEqual({
      totals: {
        people: 2,
        submitted: 2,
        challengeStarted: 2,
        challengeCompleted: 1,
        approved: 0,
        rejected: 0,
      },
      countries: [
        {
          countryCode: "PE",
          people: 2,
          submitted: 2,
          challengeStarted: 2,
          challengeCompleted: 1,
          approved: 0,
          rejected: 0,
        },
      ],
      challenges: [
        { slug: "black-box", started: 2, completed: 1 },
        { slug: "broken-agent", started: 1, completed: 0 },
        { slug: "make-it-fast", started: 0, completed: 0 },
        { slug: "power-grid", started: 0, completed: 0 },
      ],
      countryChallenges: [
        { countryCode: "PE", slug: "black-box", started: 2, completed: 1 },
        { countryCode: "PE", slug: "broken-agent", started: 1, completed: 0 },
        { countryCode: "PE", slug: "make-it-fast", started: 0, completed: 0 },
        { countryCode: "PE", slug: "power-grid", started: 0, completed: 0 },
      ],
    });
    const unknown = await getAdminInsights(
      { country: { kind: "unknown" } },
      database,
    );
    expect(unknown.totals).toEqual({
      people: 2,
      submitted: 1,
      challengeStarted: 2,
      challengeCompleted: 2,
      approved: 0,
      rejected: 0,
    });
    expect(unknown.countries).toEqual([
      {
        countryCode: null,
        people: 2,
        submitted: 1,
        challengeStarted: 2,
        challengeCompleted: 2,
        approved: 0,
        rejected: 0,
      },
    ]);

    const selected = await database.execute(sql`
      select p.id,
        ${completedChallengeParticipantCondition(sql`p.id`, "black-box")} as completed
      from participants p
      inner join (
        select distinct on (participant_id) participant_id, status
        from applications order by participant_id, created_at desc, id desc
      ) a on a.participant_id = p.id
      where a.status <> 'withdrawn' and p.country_code = 'PE'
        and ${startedChallengeParticipantCondition(sql`p.id`, "black-box")}
      order by p.id
    `);
    expect(selected.rows).toEqual([
      { id: "A", completed: true },
      { id: "G", completed: false },
    ]);
    const brokenAgent = await getAdminInsights(
      { challenge: "broken-agent" },
      database,
    );
    expect(brokenAgent.totals).toEqual({
      people: 2,
      submitted: 2,
      challengeStarted: 2,
      challengeCompleted: 1,
      approved: 0,
      rejected: 0,
    });
  });

  test("higher application ID wins timestamp ties, including withdrawn and a new draft", async () => {
    await client.exec(`
      insert into applications values
        ('a3', 'A', 'draft', '2026-09-02', null),
        ('g2', 'G', 'withdrawn', '2026-09-01', '2026-09-01');
    `);
    const report = await getAdminInsights(
      { country: { kind: "country", code: "PE" } },
      database,
    );
    expect(report.totals).toEqual({
      people: 2,
      submitted: 1,
      challengeStarted: 1,
      challengeCompleted: 1,
      approved: 0,
      rejected: 1,
    });
    expect(report.challenges).toEqual([
      { slug: "black-box", started: 1, completed: 1 },
      { slug: "broken-agent", started: 1, completed: 0 },
      { slug: "make-it-fast", started: 0, completed: 0 },
      { slug: "power-grid", started: 0, completed: 0 },
    ]);
  });

  test("ignores obsolete versions even with evaluations, including the third challenge", async () => {
    await client.exec(`
      insert into challenge_attempts (id, participant_id, challenge_slug, challenge_version) values
        ('b-future', 'B', 'make-it-fast', 'make-it-fast-v1'),
        ('b-old', 'B', 'broken-agent', 'obsolete-version');
      insert into challenge_evaluations values ('b-future-eval', 'b-future'), ('b-old-eval', 'b-old');
    `);
    const report = await getAdminInsights({}, database);
    expect(report.totals).toEqual({
      people: 6,
      submitted: 5,
      challengeStarted: 4,
      challengeCompleted: 3,
      approved: 1,
      rejected: 1,
    });
    expect(report.challenges).toEqual([
      { slug: "black-box", started: 3, completed: 2 },
      { slug: "broken-agent", started: 2, completed: 1 },
      { slug: "make-it-fast", started: 0, completed: 0 },
      { slug: "power-grid", started: 0, completed: 0 },
    ]);
  });

  test("keeps playable challenges and country matrix cells at zero activity", async () => {
    const report = await getAdminInsights(
      { country: { kind: "country", code: "CO" } },
      database,
    );
    expect(report.totals).toEqual({
      people: 1,
      submitted: 1,
      challengeStarted: 0,
      challengeCompleted: 0,
      approved: 1,
      rejected: 0,
    });
    expect(report.challenges).toEqual([
      { slug: "black-box", started: 0, completed: 0 },
      { slug: "broken-agent", started: 0, completed: 0 },
      { slug: "make-it-fast", started: 0, completed: 0 },
      { slug: "power-grid", started: 0, completed: 0 },
    ]);
    expect(report.countryChallenges).toEqual([
      { countryCode: "CO", slug: "black-box", started: 0, completed: 0 },
      { countryCode: "CO", slug: "broken-agent", started: 0, completed: 0 },
      { countryCode: "CO", slug: "make-it-fast", started: 0, completed: 0 },
      { countryCode: "CO", slug: "power-grid", started: 0, completed: 0 },
    ]);
    expect(
      await getAdminInsights(
        { country: { kind: "country", code: "CO" }, challenge: "black-box" },
        database,
      ),
    ).toEqual({
      totals: {
        people: 0,
        submitted: 0,
        challengeStarted: 0,
        challengeCompleted: 0,
        approved: 0,
        rejected: 0,
      },
      countries: [],
      challenges: [
        { slug: "black-box", started: 0, completed: 0 },
        { slug: "broken-agent", started: 0, completed: 0 },
        { slug: "make-it-fast", started: 0, completed: 0 },
        { slug: "power-grid", started: 0, completed: 0 },
      ],
      countryChallenges: [],
    });
  });

  test("renders exact rates, independent milestone explanations, and country/challenge drilldowns", async () => {
    const filters = {
      country: { kind: "country", code: "PE" },
      challenge: "black-box",
    } satisfies Parameters<typeof getAdminInsights>[0];
    const data = await getAdminInsights(filters, database);
    const html = renderToStaticMarkup(
      createElement(ParticipantInsights, { data, filters }),
    );
    expect(html).toContain("Personas con postulación vigente o rechazada");
    expect(html).toContain("Son hitos independientes, no etapas consecutivas.");
    expect(html).toContain("1 / 2 · 50");
    expect(html).toContain("2 / 2 · 100");
    expect(html).toContain(
      "/admin/participants?challenge=black-box&amp;country=PE",
    );
    expect(html).not.toContain(
      'href="/admin/participants?challenge=broken-agent',
    );
    expect(html).toContain('method="get"');

    const emptyFilters = {
      country: { kind: "country", code: "AR" },
    } satisfies Parameters<typeof getAdminInsights>[0];
    const empty = await getAdminInsights(emptyFilters, database);
    const emptyHtml = renderToStaticMarkup(
      createElement(ParticipantInsights, {
        data: empty,
        filters: emptyFilters,
      }),
    );
    expect(emptyHtml).toContain("0 / 0 · Sin base");
    expect(emptyHtml).toContain("No hay participantes con estos filtros");
    expect(emptyHtml).toContain("Black Box");
    expect(emptyHtml).not.toContain("NaN");
  });
});
