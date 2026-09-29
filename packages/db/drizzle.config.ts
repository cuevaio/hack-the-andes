import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

if (!process.env.NEW_DATABASE_URL) {
  throw new Error("NEW_DATABASE_URL is required to run Drizzle Kit");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEW_DATABASE_URL,
  },
});
