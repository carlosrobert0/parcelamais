import { afterAll, beforeEach } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://parcelamais:parcelamais@localhost:5432/parcelamais_test";
process.env.LOG_LEVEL = "silent";

const { runMigrations, sql } = await import("@/server/db/client");
await runMigrations();

beforeEach(async () => {
  await sql`truncate selected_offer, lender_result, pre_approval, patient cascade`;
});

afterAll(async () => {
  await sql.end();
});
