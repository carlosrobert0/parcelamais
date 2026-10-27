import { after } from "next/server";
import { createPreApprovalSchema } from "@/domain/schemas";
import { parseBody, withErrorHandling } from "@/server/http";
import { startPreApproval } from "@/server/run-pre-approval";

export const POST = withErrorHandling(async (request: Request) => {
  const body = await parseBody(request, createPreApprovalSchema);
  if ("response" in body) return body.response;

  const { id, run } = await startPreApproval(body.data);
  after(() => run());

  return Response.json({ id }, { status: 201 });
});
