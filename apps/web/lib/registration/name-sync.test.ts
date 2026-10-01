import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { eq } from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { rankingDisplayName } from "../challenges/names";
import { resolveBadgeProfile } from "../credential/profile";
import { reconcileParticipantNames } from "./name-sync";
import { participantIdFor } from "./participants";

const client = new PGlite();
const database = drizzle(client);
const migrations = new URL("../../../../packages/db/drizzle/", import.meta.url);
const future = () => new Date(Date.now() + 1_000);

beforeAll(async () => {
  const files = (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files)
    await client.exec(await readFile(new URL(file, migrations), "utf8"));
});
beforeEach(async () => {
  await client.exec("truncate participants cascade");
});
afterAll(async () => {
  await client.close();
});

describe("participant names", () => {
  test("concurrent first logins create one public name and no legal name; later logins preserve edits", async () => {
    const ids = await Promise.all(
      Array.from({ length: 4 }, () =>
        participantIdFor("user_ada", "Ada Clerk", database),
      ),
    );
    expect(new Set(ids).size).toBe(1);
    expect(
      await database
        .select({ name: participants.name, legalName: participants.legalName })
        .from(participants),
    ).toEqual([{ name: "Ada Clerk", legalName: null }]);
    await database
      .update(participants)
      .set({ name: "Ada L.", legalName: "Augusta Ada King" });
    await participantIdFor("user_ada", "Outdated Clerk", database);
    const [saved] = await database.select().from(participants);
    expect(saved?.name).toBe("Ada L.");
    expect(saved?.legalName).toBe("Augusta Ada King");
    expect(
      rankingDisplayName({
        name: saved?.name,
        firstName: "Old",
        lastName: "Application",
      }),
    ).toBe("Ada L.");
    expect(
      resolveBadgeProfile({
        name: saved?.name,
        firstName: "Old",
        lastName: "Application",
      }).fullName,
    ).toBe("Ada L.");
  });

  test("accounts without a usable Clerk name can log in and later choose a public name", async () => {
    const id = await participantIdFor("user_empty", " ", database);
    await participantIdFor("user_long", "x".repeat(201), database);
    expect(
      await database.select({ name: participants.name }).from(participants),
    ).toEqual([{ name: null }, { name: null }]);
    await database
      .update(participants)
      .set({ name: "cueva" })
      .where(eq(participants.id, id));
    await participantIdFor("user_empty", "Clerk Default", database);
    expect(
      (
        await database
          .select()
          .from(participants)
          .where(eq(participants.id, id))
      )[0]?.name,
    ).toBe("cueva");
  });

  test("sync preserves public names exactly, clears old Clerk surnames, and never copies the legal name", async () => {
    const id = await participantIdFor(
      "user_maria",
      "María José de la Cruz",
      database,
    );
    await database
      .update(participants)
      .set({ legalName: "PRIVATE DOCUMENT NAME" })
      .where(eq(participants.id, id));
    let remote = { firstName: "Old", lastName: "Surname" };
    const result = await reconcileParticipantNames(
      database,
      {
        getUser: async () => remote,
        updateUser: async (_id, names) => {
          remote = names;
        },
      },
      future(),
    );
    expect(result).toEqual({ synchronized: 1, failures: [] });
    expect(remote).toEqual({
      firstName: "María José de la Cruz",
      lastName: "",
    });
    expect((await database.select().from(participants))[0]?.legalName).toBe(
      "PRIVATE DOCUMENT NAME",
    );
  });

  test("Clerk failure keeps the saved name and retries without blocking other participants", async () => {
    await participantIdFor("user_fail", "New name", database);
    await participantIdFor("user_ok", "Other name", database);
    const remote = new Map<string, { firstName: string; lastName: string }>();
    let unavailable = true;
    const clerk = {
      getUser: async () => ({ firstName: "Old", lastName: "Name" }),
      updateUser: async (
        id: string,
        names: { firstName: string; lastName: string },
      ) => {
        if (id === "user_fail" && unavailable)
          throw new Error("Clerk unavailable");
        remote.set(id, names);
      },
    };
    const now = future();
    const failed = await reconcileParticipantNames(database, clerk, now);
    expect(failed.synchronized).toBe(1);
    expect(failed.failures.map((failure) => String(failure.error))).toEqual([
      "Error: Clerk unavailable",
    ]);
    expect(remote.get("user_ok")).toEqual({
      firstName: "Other name",
      lastName: "",
    });
    unavailable = false;
    const retried = await reconcileParticipantNames(
      database,
      clerk,
      new Date(now.getTime() + 6 * 60_000),
    );
    expect(retried).toEqual({ synchronized: 1, failures: [] });
    expect(remote.get("user_fail")).toEqual({
      firstName: "New name",
      lastName: "",
    });
  });

  test("an edit during a Clerk request remains due and the next run sends the latest name", async () => {
    const id = await participantIdFor("user_race", "First name", database);
    let remote = { firstName: "Old", lastName: "Surname" };
    let editDuringRequest = true;
    const clerk = {
      getUser: async () => remote,
      updateUser: async (
        _id: string,
        names: { firstName: string; lastName: string },
      ) => {
        if (editDuringRequest) {
          await database
            .update(participants)
            .set({ name: "Latest name" })
            .where(eq(participants.id, id));
          editDuringRequest = false;
        }
        remote = names;
      },
    };
    await reconcileParticipantNames(database, clerk, future());
    expect(remote.firstName).toBe("First name");
    await reconcileParticipantNames(database, clerk, future());
    expect(remote).toEqual({ firstName: "Latest name", lastName: "" });
    expect((await database.select().from(participants))[0]?.name).toBe(
      "Latest name",
    );
  });

  test("periodic audits repair a late remote write after a successful synchronization", async () => {
    await participantIdFor("user_late", "Current name", database);
    let remote = { firstName: "Old", lastName: "Surname" };
    const clerk = {
      getUser: async () => remote,
      updateUser: async (
        _id: string,
        names: { firstName: string; lastName: string },
      ) => {
        remote = names;
      },
    };
    const now = future();
    await reconcileParticipantNames(database, clerk, now);
    expect(remote.firstName).toBe("Current name");
    remote = { firstName: "Late obsolete request", lastName: "" };
    await reconcileParticipantNames(
      database,
      clerk,
      new Date(now.getTime() + 61 * 60_000),
    );
    expect(remote).toEqual({ firstName: "Current name", lastName: "" });
  });

  test("legal and country edits leave the public-name synchronization schedule unchanged", async () => {
    const id = await participantIdFor("user_other_fields", "Public", database);
    const now = future();
    await reconcileParticipantNames(
      database,
      {
        getUser: async () => ({ firstName: "Public", lastName: null }),
        updateUser: async () => {
          throw new Error("Matching Clerk name must not be rewritten");
        },
      },
      now,
    );
    const [before] = await database.select().from(participants);
    await database
      .update(participants)
      .set({ legalName: "Document name", countryCode: "PE" })
      .where(eq(participants.id, id));
    const [after] = await database.select().from(participants);
    expect(after?.name).toBe("Public");
    expect(after?.legalName).toBe("Document name");
    expect(after?.nameSyncAfter.toISOString()).toBe(
      new Date(now.getTime() + 60 * 60_000).toISOString(),
    );
    expect(after?.nameSyncToken).toBe(before?.nameSyncToken);
  });
});
