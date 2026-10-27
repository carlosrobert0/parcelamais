import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft } from "./draft";
import { RegistrationForm } from "./RegistrationForm";

const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const brl = (value: string) => `R$ ${value}`;

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
  replace.mockReset();
});

type User = ReturnType<typeof userEvent.setup>;

async function fillPersonalData(user: User) {
  await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "1990-05-10" } });
  await user.type(screen.getByLabelText("Celular"), "11987654321");
}

async function goToReview(user: User) {
  await fillPersonalData(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(await screen.findByLabelText("Renda mensal"), "500000");
  await user.type(screen.getByLabelText("Valor do tratamento"), "1000000");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("RegistrationForm", () => {
  it("shows the CPF error on blur, with the mask applied", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await user.type(screen.getByLabelText("CPF"), "52998224726");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-26");
    await user.tab();
    expect(await screen.findByText("CPF inválido")).toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the error while the user fixes the field, without leaving it", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe o celular")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Celular"), "11987654321");
    await waitFor(() => expect(screen.getByLabelText("Celular")).toHaveAttribute("aria-invalid", "false"));
    expect(document.getElementById("phone-error")).not.toBeInTheDocument();
  });

  it("does not move forward with invalid fields and does when they are valid", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe o nome completo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados pessoais" })).toBeInTheDocument();

    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Dados financeiros" })).toBeInTheDocument();
  });

  it("two submits in the same tick advance a single step", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await fillPersonalData(user);
    const form = screen.getByRole("button", { name: "Continuar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(await screen.findByRole("heading", { name: "Dados financeiros" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("heading", { name: "Dados financeiros" })).toBeInTheDocument();
  });

  it("starting a new pre-approval while on the form empties it and goes back to the first step", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByLabelText("Renda mensal");

    act(() => clearDraft());
    expect(await screen.findByRole("heading", { name: "Dados pessoais" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("");
  });

  it("a 422 without a known field shows a general error and moves focus to it", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { scenario: "Cenário inválido" } }), { status: 422 })));
    render(<RegistrationForm />);
    await goToReview(user);
    await user.click(await screen.findByRole("button", { name: "Consultar financeiras" }));
    const alert = await screen.findByText(/Não foi possível iniciar a consulta/);
    await waitFor(() => expect(alert.closest("[data-slot=alert]")).toHaveFocus());
  });

  it("a 422 on a field focuses that field on its step", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { "patient.phone": "Celular bloqueado" } }), { status: 422 })));
    render(<RegistrationForm />);
    await goToReview(user);
    await user.click(await screen.findByRole("button", { name: "Consultar financeiras" }));
    expect(await screen.findByText("Celular bloqueado")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Celular")).toHaveFocus());
  });

  it("going back one step loses nothing", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(await screen.findByLabelText("Renda mensal"), "500000");

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByLabelText("Renda mensal")).toHaveValue(brl("5.000,00"));
  });

  it("the currency field can be cleared with backspace", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm initialStep="financial" />);
    const income = await screen.findByLabelText("Renda mensal");
    await user.type(income, "5");
    expect(income).toHaveValue(brl("0,05"));
    await user.type(income, "{backspace}{backspace}{backspace}{backspace}");
    expect(income).toHaveValue("");
  });

  it("Edit on the review step goes back and focuses the field", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await goToReview(user);
    await user.click(await screen.findByRole("button", { name: "Editar Celular" }));
    await waitFor(() => expect(screen.getByLabelText("Celular")).toHaveFocus());
  });

  it("a 422 from the API shows up on the right field and goes back to its step", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { "patient.cpf": "CPF bloqueado (exemplo)" } }), { status: 422 }));
    vi.stubGlobal("fetch", fetch);

    render(<RegistrationForm />);
    await goToReview(user);
    await user.click(await screen.findByRole("button", { name: "Consultar financeiras" }));

    expect(await screen.findByText("CPF bloqueado (exemplo)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados pessoais" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      patient: {
        name: "Maria da Silva",
        cpf: "52998224725",
        birthDate: "1990-05-10",
        phone: "11987654321",
        monthlyIncomeCents: 500_000,
        treatmentAmountCents: 1_000_000,
      },
      scenario: "random",
    });
  });

  it("after a successful submit the button stays disabled while navigating (no second pre-approval)", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);

    render(<RegistrationForm />);
    await goToReview(user);
    await user.click(await screen.findByRole("button", { name: "Consultar financeiras" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/pre-approvals/abc"));
    const submit = screen.getByRole("button", { name: "Enviando…" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("restores the session draft, applies the suggested amount and saves it back", async () => {
    sessionStorage.setItem(
      "parcelamais:draft",
      JSON.stringify({ name: "Maria da Silva", monthlyIncomeCents: 300_000, treatmentAmountCents: 4_000_000 }),
    );
    render(<RegistrationForm initialStep="financial" suggestedAmountCents={3_000_000} />);

    expect(await screen.findByLabelText("Valor do tratamento")).toHaveValue(brl("30.000,00"));
    expect(screen.getByLabelText("Renda mensal")).toHaveValue(brl("3.000,00"));
    expect(JSON.parse(sessionStorage.getItem("parcelamais:draft")!)).toMatchObject({ treatmentAmountCents: 3_000_000 });
    expect(replace).toHaveBeenCalledWith("/?step=financial");
  });
});
