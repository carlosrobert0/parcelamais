import { isValidId, notFound, withErrorHandling } from "@/server/http";
import { findPreApproval } from "@/server/repository";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (_request: Request, { params }: RouteContext<"/api/pre-approvals/[id]">) => {
  const { id } = await params;
  if (!isValidId(id)) return notFound();

  const preApproval = await findPreApproval(id);
  return preApproval ? Response.json(preApproval) : notFound();
});
