import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { Schema } from "effect";
import { RepositoryAnalysisSchema } from "../apps/web/lib/judging/contract";

const path = process.argv[2];
if (!path)
  throw new Error(
    "Provide a results.json path. Use --apply to save verified reports.",
  );
const databaseUrl = process.env.NEW_DATABASE_URL;
if (!databaseUrl) throw new Error("NEW_DATABASE_URL is required.");
const reports = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      teamId: Schema.String.pipe(Schema.check(Schema.isUUID())),
      analysis: RepositoryAnalysisSchema,
    }),
  ),
)(JSON.parse(await readFile(path, "utf8")));
if (reports.length === 0) throw new Error("No reports to import.");
if (new Set(reports.map((report) => report.teamId)).size !== reports.length)
  throw new Error("Duplicate team reports.");
const query = neon(databaseUrl);
const snapshots = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      team_id: Schema.String,
      repository_url: Schema.String,
    }),
  ),
)(
  await query`select team_id, snapshot->'project'->'submission'->>'githubUrl' as repository_url from judging_presentations`,
);
for (const report of reports) {
  const snapshot = snapshots.find((row) => row.team_id === report.teamId);
  if (!snapshot || snapshot.repository_url !== report.analysis.repositoryUrl)
    throw new Error(`Frozen repository mismatch for team ${report.teamId}.`);
  if (report.analysis.status === "completed" && !report.analysis.commitSha)
    throw new Error(`Missing reviewed commit for team ${report.teamId}.`);
}
if (process.argv.includes("--apply")) {
  await query.transaction(
    reports.map(
      (report) => query`
    update judging_presentations
    set snapshot=jsonb_set(snapshot,'{repositoryAnalysis}',${JSON.stringify(report.analysis)}::jsonb,true)
    where team_id=${report.teamId}::uuid
      and snapshot->'project'->'submission'->>'githubUrl'=${report.analysis.repositoryUrl}
    returning team_id
  `,
    ),
  );
  const stored = Schema.decodeUnknownSync(
    Schema.Array(
      Schema.Struct({
        team_id: Schema.String,
        analysis: RepositoryAnalysisSchema,
      }),
    ),
  )(
    await query`select team_id,snapshot->'repositoryAnalysis' as analysis from judging_presentations where snapshot ? 'repositoryAnalysis'`,
  );
  for (const report of reports) {
    const saved = stored.find((row) => row.team_id === report.teamId);
    if (
      !saved ||
      JSON.stringify(saved.analysis) !== JSON.stringify(report.analysis)
    )
      throw new Error(
        `Stored report verification failed for team ${report.teamId}.`,
      );
  }
}
console.log(
  JSON.stringify({
    applied: process.argv.includes("--apply"),
    reports: reports.length,
    completed: reports.filter(
      (report) => report.analysis.status === "completed",
    ).length,
    unavailable: reports.filter(
      (report) => report.analysis.status === "unavailable",
    ).length,
  }),
);
