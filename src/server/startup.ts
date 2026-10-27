import { runMigrations } from "./db/client";
import { logger } from "./logger";
import { completeStalePreApprovals } from "./repository";

export async function prepareDatabase() {
  await runMigrations();
  const stale = await completeStalePreApprovals();
  if (stale > 0) logger.warn({ stale }, "stale pre-approvals completed on startup");
}
