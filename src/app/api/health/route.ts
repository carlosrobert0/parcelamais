import { sql } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await sql`select 1`;
  return Response.json({ ok: true });
});
