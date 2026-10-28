import { runMigrations } from "./db/client";
import { errorSummary, logger } from "./logger";
import { completeStalePreApprovals } from "./repository";
import { retry } from "./retry";

const DATABASE_READY_ATTEMPTS = 30;
const DATABASE_READY_DELAY_MS = 1_000;

export async function prepareDatabase() {
  try {
    await retry(runMigrations, {
      attempts: DATABASE_READY_ATTEMPTS,
      delayMs: DATABASE_READY_DELAY_MS,
      onRetry: (attempt, error) => logger.warn({ attempt, ...errorSummary(error) }, "database not ready, retrying"),
    });
  } catch (error) {
    logger.fatal(errorSummary(error), "database unavailable, exiting so the container restarts");
    process.exit(1);
  }

  const stale = await completeStalePreApprovals();
  if (stale > 0) logger.warn({ stale }, "stale pre-approvals completed on startup");
}
