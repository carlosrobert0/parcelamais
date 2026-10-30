import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LenderResult, PreApproval } from "@/domain/types";
import { NoApproval } from "./NoApproval";

const result = (lenderName: string, status: LenderResult["status"], reason: string): LenderResult => ({
  lenderId: lenderName.toLowerCase(),
  lenderName,
  status,
  reason,
  approvedAmountCents: null,
  monthlyRate: null,
  terms: null,
  latencyMs: 1000,
});

const preApproval = (changes: Partial<PreApproval> = {}): PreApproval => ({
  id: "p1",
  status: "completed",
  scenario: "random",
  treatmentAmountCents: 4_000_000,
  createdAt: "2026-10-27T12:00:00Z",
  deadlineAt: "2026-10-27T12:00:10Z",
  results: [
    result("Alfa", "declined", "Renda × 10 (R$ 30.000,00) é menor que o valor do tratamento"),
    result("Gama", "declined", "Valor acima de R$ 20.000,00"),
    result("Delta", "unavailable", "timeout"),
  ],
  offers: [],
  selection: null,
  suggestedAmountCents: 3_000_000,
  ...changes,
});

describe("NoApproval", () => {
  it("explains each lender's reason in plain language", () => {
    render(<NoApproval preApproval={preApproval()} />);
    expect(screen.getByText(/Valor acima de R\$\s20\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Não respondeu dentro de 15 segundos")).toBeInTheDocument();
  });

  it("offers the suggested amount, another amount and a retry when someone did not answer", () => {
    render(<NoApproval preApproval={preApproval()} />);
    expect(screen.getByRole("link", { name: /Tentar com R\$\s30\.000,00/ })).toHaveAttribute("href", "/?step=financial&amount=3000000");
    expect(screen.getByRole("link", { name: "Tentar com outro valor" })).toHaveAttribute("href", "/?step=financial");
    expect(screen.getByRole("link", { name: "Consultar de novo" })).toHaveAttribute("href", "/?step=review");
  });

  it("keeps the demo mode when the pre-approval used a forced scenario", () => {
    render(<NoApproval preApproval={preApproval({ scenario: "none-approve" })} />);
    expect(screen.getByRole("link", { name: /Tentar com R\$\s30\.000,00/ })).toHaveAttribute(
      "href",
      "/?step=financial&amount=3000000&demo=1",
    );
  });

  it("without a suggestion and with no unavailable lender, only another amount is offered", () => {
    render(
      <NoApproval
        preApproval={preApproval({ suggestedAmountCents: null, results: [result("Beta", "declined", "Recusa forçada pelo cenário de demonstração")] })}
      />,
    );
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Tentar com outro valor"]);
  });
});
