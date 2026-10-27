import { PreApprovalJourney } from "@/features/pre-approval/PreApprovalJourney";

export default async function PreApprovalPage({ params }: PageProps<"/pre-approvals/[id]">) {
  const { id } = await params;
  return <PreApprovalJourney id={id} />;
}
