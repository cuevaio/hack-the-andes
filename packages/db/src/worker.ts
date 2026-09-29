import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema/index";

const databaseUrl = process.env.NEW_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("NEW_DATABASE_URL is not configured");
}

const sql = neon(databaseUrl);

export const db = drizzle({ client: sql, schema });
