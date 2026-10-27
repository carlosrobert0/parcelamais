import { sql } from "./db/client";

export async function subscribeToPreApproval(preApprovalId: string, onChange: () => void): Promise<() => Promise<void>> {
  const { unlisten } = await sql.listen(`pre_approval_${preApprovalId.toLowerCase()}`, onChange, onChange);
  return unlisten;
}
