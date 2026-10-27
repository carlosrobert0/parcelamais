import { RegistrationForm } from "@/features/registration/RegistrationForm";
import { parseRegistrationParams } from "@/features/registration/urls";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { step, amountCents, demo } = parseRegistrationParams(await searchParams);
  return <RegistrationForm showScenario={demo} initialStep={step} suggestedAmountCents={amountCents ?? undefined} />;
}
