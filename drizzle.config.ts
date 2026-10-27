import { defineConfig } from "drizzle-kit";
import { DATABASE_URL } from "./src/server/db/config";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
