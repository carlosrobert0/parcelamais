import { selectionSchema } from "@/domain/schemas";
import { isValidId, notFound, parseBody, withErrorHandling } from "@/server/http";
import { selectOffer } from "@/server/repository";

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext<"/api/pre-approvals/[id]/selection">) => {
  const { id } = await params;
  if (!isValidId(id)) return notFound();

  const body = await parseBody(request, selectionSchema);
  if ("response" in body) return body.response;

  const result = await selectOffer(id, body.data);
  switch (result.kind) {
    case "created":
      return Response.json(result.selection, { status: 201 });
    case "repeated":
      return Response.json(result.selection, { status: 200 });
    case "conflict":
      return Response.json(
        { error: "Esta pré-aprovação já tem outra oferta escolhida", selection: result.selection },
        { status: 409 },
      );
    case "pending":
      return Response.json({ error: "A pré-aprovação ainda está em andamento" }, { status: 409 });
    case "invalid-offer":
      return Response.json({ error: "Esta oferta não existe para a pré-aprovação" }, { status: 422 });
    case "not-found":
      return notFound();
  }
});
