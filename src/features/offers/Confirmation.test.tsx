import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Selection } from "@/domain/types";
import { Confirmation } from "./Confirmation";

const selection: Selection = {
  lenderId: "beta",
  lenderName: "Beta",
  term: 12,
  installmentCents: 56_701,
  totalCents: 680_412,
  uncoveredCents: 400_000,
  selectedAt: "2026-10-27T12:00:00Z",
};

describe("Confirmation", () => {
  it("clears the patient's draft so the next patient starts empty", () => {
    sessionStorage.setItem("parcelamais:draft", JSON.stringify({ name: "Maria da Silva" }));
    render(<Confirmation selection={selection} />);
    expect(sessionStorage.getItem("parcelamais:draft")).toBeNull();
  });

  it("warns when the chosen offer only finances part of the treatment", () => {
    render(<Confirmation selection={selection} />);
    expect(screen.getByText(/financiamento é parcial: R\$\s4\.000,00/)).toBeInTheDocument();
  });

  it("explains when another selection had already been saved", () => {
    render(<Confirmation selection={{ ...selection, uncoveredCents: 0 }} alreadySelected />);
    expect(screen.getByText(/já tinha outra oferta escolhida/)).toBeInTheDocument();
    expect(screen.queryByText(/financiamento é parcial/)).not.toBeInTheDocument();
  });
});
