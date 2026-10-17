import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { encryptSensitiveValue } from "@/lib/registration/sensitive";

export async function createCheckinFixture() {
  const client = new PGlite();
  const migrations = new URL(
    "../../../../../packages/db/drizzle/",
    import.meta.url,
  );
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await client.exec(await readFile(new URL(file, migrations), "utf8"));
  }
  const key = Buffer.alloc(32, 8).toString("base64");
  process.env.PARTICIPANT_DATA_ENCRYPTION_KEY = key;
  let counter = 0;
  async function seed({
    name,
    legalName,
    document,
    confirmed,
    status = "accepted",
    email,
  }: {
    name: string;
    legalName: string;
    document: string | null;
    confirmed: boolean;
    status?: string;
    email?: string;
  }) {
    const clerkUserId = `person-${++counter}`;
    const person = (
      await client.query<{ id: string }>(
        "insert into participants(clerk_user_id,name,legal_name) values($1,$2,$3) returning id",
        [clerkUserId, name, legalName],
      )
    ).rows[0];
    if (!person) throw new Error("Missing fixture participant");
    const application = (
      await client.query<{ id: string }>(
        "insert into applications(participant_id,status,participation_mode,email,picture_url) values($1,$2,'in_person',$3,'https://example.com/avatar.png') returning id",
        [person.id, status, email ?? `${name.toLowerCase()}@example.com`],
      )
    ).rows[0];
    if (!application) throw new Error("Missing fixture application");
    let encryptedDocument: string | null = null;
    if (document !== null)
      encryptedDocument = encryptSensitiveValue(document, key);
    let completedAt: Date | null = null;
    if (confirmed) completedAt = new Date();
    await client.query(
      "insert into acceptance_details(application_id,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone,shirt_size) values($1,$2,'2000-01-01',$3,'Contacto','999999999','m')",
      [application.id, completedAt, encryptedDocument],
    );
    return {
      participantId: person.id,
      applicationId: application.id,
      clerkUserId,
    };
  }
  return { client, key, seed };
}
