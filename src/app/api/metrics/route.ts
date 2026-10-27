import { sql } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const rows = await sql`
    select
      lender_id as "lenderId",
      count(*)::int as "requests",
      round(avg((lender_result.status = 'approved')::int) * 100, 1)::float as "approvedPct",
      round(avg((lender_result.status = 'declined')::int) * 100, 1)::float as "declinedPct",
      round(avg((lender_result.status = 'unavailable' and reason = 'error')::int) * 100, 1)::float as "errorPct",
      round(avg((lender_result.status = 'unavailable' and reason = 'timeout')::int) * 100, 1)::float as "timeoutPct",
      (percentile_cont(0.5) within group (order by latency_ms) filter (where lender_result.status in ('approved', 'declined')))::int as "latencyP50Ms",
      (percentile_cont(0.95) within group (order by latency_ms) filter (where lender_result.status in ('approved', 'declined')))::int as "latencyP95Ms"
    from lender_result
    join pre_approval on pre_approval.id = lender_result.pre_approval_id
    where lender_result.status <> 'pending' and pre_approval.scenario = 'random'
    group by lender_id
    order by lender_id
  `;
  return Response.json(rows);
});
