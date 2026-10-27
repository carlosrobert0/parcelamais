import { isValidId, notFound, withErrorHandling } from "@/server/http";
import { findPreApproval } from "@/server/repository";
import { createSnapshotStream } from "@/server/snapshot-stream";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext<"/api/pre-approvals/[id]/events">) => {
  const { id } = await params;
  if (!isValidId(id) || !(await findPreApproval(id))) return notFound();

  return new Response(createSnapshotStream(id, request.signal), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
