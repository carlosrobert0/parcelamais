import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { DATABASE_URL } from "./config";
import * as schema from "./schema";

const MAX_CONNECTIONS = 10;

function connect() {
  const sql = postgres(DATABASE_URL, { max: MAX_CONNECTIONS, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema }) };
}

const globalForDb = globalThis as unknown as { dbConnection?: ReturnType<typeof connect> };
const connection = (globalForDb.dbConnection ??= connect());

export const sql = connection.sql;
export const db = connection.db;

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
