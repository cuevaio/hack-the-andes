import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migrates the latest nonblank legal name without replacing public names or losing attendance details", async () => {
  const client = new PGlite();
  try {
    const migrations = new URL(
      "../../../../packages/db/drizzle/",
      import.meta.url,
    );
    const files = (await readdir(migrations))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files.filter((file) => file < "0026_")) {
      await client.exec(await readFile(new URL(file, migrations), "utf8"));
    }
    await client.exec(`
      insert into participants (id, clerk_user_id, name) values
        ('00000000-0000-4000-8000-000000000001', 'public', 'Badge alias'),
        ('00000000-0000-4000-8000-000000000002', 'missing', null),
        ('00000000-0000-4000-8000-000000000003', 'blank', '  ');
      insert into applications (id, participant_id, status) values
        ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'rejected'),
        ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'rejected'),
        ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'draft'),
        ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000002', 'draft');
      insert into acceptance_details (application_id, full_name, phone, updated_at) values
        ('00000000-0000-4000-8000-000000000011', 'Older legal name', '111', '2026-09-01'),
        ('00000000-0000-4000-8000-000000000012', '  Current legal name  ', '222', '2026-09-02'),
        ('00000000-0000-4000-8000-000000000013', '  ', '333', '2026-09-03'),
        ('00000000-0000-4000-8000-000000000014', 'Private legal name', '444', '2026-09-02');
    `);
    await client.exec(
      await readFile(new URL("0026_fuzzy_rage.sql", migrations), "utf8"),
    );
    expect(
      (
        await client.query(
          "select clerk_user_id, name, legal_name from participants order by clerk_user_id",
        )
      ).rows,
    ).toEqual([
      { clerk_user_id: "blank", name: null, legal_name: null },
      {
        clerk_user_id: "missing",
        name: null,
        legal_name: "Private legal name",
      },
      {
        clerk_user_id: "public",
        name: "Badge alias",
        legal_name: "Current legal name",
      },
    ]);
    expect(
      (
        await client.query(
          "select phone from acceptance_details order by phone",
        )
      ).rows,
    ).toEqual([
      { phone: "111" },
      { phone: "222" },
      { phone: "333" },
      { phone: "444" },
    ]);
    await expect(
      client.exec("update acceptance_details set completed_at = now()"),
    ).rejects.toThrow("acceptance_details_completed_fields_required");
  } finally {
    await client.close();
  }
});
