import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import {
  ProjectDashboardSchema,
  TeamProjectSchema,
} from "@chofex/registration-contract";
import { PGlite } from "@electric-sql/pglite";
import { Schema } from "effect";

test("GitHub migration preserves legacy submissions, archives and frozen judging snapshots", async () => {
  const db = new PGlite();
  const directory = new URL(
    "../../../../packages/db/drizzle/",
    import.meta.url,
  );
  try {
    const files = (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files.filter((file) => !file.startsWith("0038_"))) {
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    }
    await db.exec(`
      insert into teams(id,name) values('00000000-0000-4000-8000-000000000001','Equipo anterior');
      insert into project_submissions(team_id,deployment_url,presentation_url,description)
        values('00000000-0000-4000-8000-000000000001','https://demo.example.com','https://slides.example.com','Descripción original');
      insert into project_archives(team_id,snapshot)
        select id,hackathon_project_view(id) from teams;
      insert into judging_presentations(team_id,snapshot,position)
        select id,hackathon_project_view(id),0 from teams;
    `);
    for (const file of files.filter((file) => file.startsWith("0038_"))) {
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    }
    const dashboard = await db.query<{ value: unknown }>(
      "select hackathon_project_dashboard() as value",
    );
    const parsed = Schema.decodeUnknownSync(ProjectDashboardSchema)(
      dashboard.rows[0]?.value,
    );
    expect(parsed.projects[0]?.submission?.githubUrl).toBeNull();
    expect(parsed.projects[0]?.submission?.description).toBe(
      "Descripción original",
    );
    expect(parsed.archives[0]?.project.submission?.githubUrl).toBeNull();
    const snapshot = await db.query<{ snapshot: unknown }>(
      "select snapshot from judging_presentations",
    );
    const frozen = Schema.decodeUnknownSync(TeamProjectSchema)(
      snapshot.rows[0]?.snapshot,
    );
    expect(frozen.submission?.githubUrl).toBeNull();
    expect(frozen.submission?.deploymentUrl).toBe("https://demo.example.com");
  } finally {
    await db.close();
  }
});
