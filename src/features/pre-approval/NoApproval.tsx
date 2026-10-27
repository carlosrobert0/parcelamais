import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/domain/format";
import type { PreApproval } from "@/domain/types";
import { registrationUrl } from "@/features/registration/urls";
import { reasonMessage } from "./lender-status";

interface NoApprovalProps {
  preApproval: PreApproval;
}

export function NoApproval({ preApproval }: NoApprovalProps) {
  const someUnavailable = preApproval.results.some((result) => result.status === "unavailable");
  const suggestion = preApproval.suggestedAmountCents;
  const demo = preApproval.scenario !== "random";

  return (
    <Alert role="status">
      <AlertTitle>
        <h2>Nenhuma financeira aprovou {formatBRL(preApproval.treatmentAmountCents)}</h2>
      </AlertTitle>
      <AlertDescription className="space-y-4">
        <ul className="list-disc space-y-1 pl-5">
          {preApproval.results.map((result) => (
            <li key={result.lenderId}>
              <strong>{result.lenderName}:</strong> {reasonMessage(result)}
            </li>
          ))}
        </ul>
        <p>
          {suggestion
            ? `Com a renda informada, a Alfa aprovaria até ${formatBRL(suggestion)}.`
            : "Tente um valor menor ou revise os dados do paciente."}
          {someUnavailable && " Alguma financeira não respondeu: consultar de novo também pode ajudar."}
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestion && (
            <Button asChild>
              <Link href={registrationUrl({ step: "financial", amountCents: suggestion, demo })}>Tentar com {formatBRL(suggestion)}</Link>
            </Button>
          )}
          <Button asChild variant={suggestion ? "outline" : "default"}>
            <Link href={registrationUrl({ step: "financial", demo })}>Tentar com outro valor</Link>
          </Button>
          {someUnavailable && (
            <Button asChild variant="outline">
              <Link href={registrationUrl({ step: "review", demo })}>Consultar de novo</Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
