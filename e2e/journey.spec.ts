import { expect, test, type Page } from "@playwright/test";
import type { Scenario } from "../src/domain/scenarios";

interface Registration {
  scenario: Scenario;
  monthlyIncomeCents?: string;
  treatmentAmountCents?: string;
}

async function fillPersonalData(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria da Silva");
  await page.getByLabel("CPF").fill("52998224725");
  await page.getByLabel("Data de nascimento").fill("1990-05-10");
  await page.getByLabel("Celular").fill("11987654321");
}

async function register(page: Page, { scenario, monthlyIncomeCents = "500000", treatmentAmountCents = "1000000" }: Registration) {
  await page.goto("/?demo=1");
  await fillPersonalData(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Renda mensal").fill(monthlyIncomeCents);
  await page.getByLabel("Valor do tratamento").fill(treatmentAmountCents);
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Cenário de demonstração").selectOption(scenario);
  await page.getByRole("button", { name: "Consultar financeiras" }).click();
  await expect(page).toHaveURL(/\/pre-approvals\/[0-9a-f-]{36}$/);
}

const lenderCard = (page: Page, lenderId: string) => page.getByTestId(`lender-${lenderId}`);

test("all approve → sort → select → the confirmation survives a reload", async ({ page }) => {
  await register(page, { scenario: "all-approve" });

  for (const lenderId of ["alfa", "beta", "gama", "delta"]) {
    await expect(lenderCard(page, lenderId)).toHaveAttribute("data-status", "approved", { timeout: 10_000 });
  }
  const offers = page.getByTestId("offer");
  await expect(offers).toHaveCount(12);
  await expect(page.getByText(/A Beta aprovou R\$\s6\.000,00 de R\$\s10\.000,00/)).toBeVisible();

  await expect(offers.first()).toContainText("Beta");
  await expect(offers.first()).toContainText("24×");
  await page.getByRole("button", { name: "Menor custo total" }).click();
  await expect(offers.first()).toContainText("Beta");
  await expect(offers.first()).toContainText("12×");
  await expect(offers.nth(1)).toContainText("Alfa");
  await expect(offers.nth(1)).toContainText("6×");

  await page.getByRole("button", { name: /Escolher Alfa em 12 parcelas/ }).click();
  await expect(page.getByRole("heading", { name: "Oferta escolhida" })).toBeVisible();
  await expect(page.getByText(/12× de R\$\s974,28/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Oferta escolhida" })).toBeVisible();
});

test("Delta fails: shown as unavailable while the other offers go on", async ({ page }) => {
  await register(page, { scenario: "delta-fails" });
  await expect(lenderCard(page, "delta")).toHaveAttribute("data-status", "unavailable", { timeout: 10_000 });
  await expect(lenderCard(page, "delta")).toContainText("Erro na comunicação com a financeira");
  await expect(page.getByTestId("offer")).toHaveCount(9);
});

test("Delta times out: the journey moves on at 10s with Delta unavailable", async ({ page }) => {
  await register(page, { scenario: "delta-timeout" });
  await expect(lenderCard(page, "alfa")).toHaveAttribute("data-status", "approved", { timeout: 5_000 });
  await expect(lenderCard(page, "delta")).toHaveAttribute("data-status", "pending");
  await expect(page.getByText(/Aguardando respostas/)).toBeVisible();

  await expect(lenderCard(page, "delta")).toHaveAttribute("data-status", "unavailable", { timeout: 12_000 });
  await expect(lenderCard(page, "delta")).toContainText("Não respondeu dentro de 10 segundos");
  await expect(page.getByTestId("offer")).toHaveCount(9);
});

test("none approve → explains why → trying a lower amount keeps the data", async ({ page }) => {
  await register(page, { scenario: "none-approve", monthlyIncomeCents: "300000", treatmentAmountCents: "4000000" });

  await expect(page.getByRole("heading", { name: /Nenhuma financeira aprovou/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Alfa: Renda × 10" })).toBeVisible();
  await page.getByRole("link", { name: /Tentar com R\$\s30\.000,00/ }).click();

  await expect(page.getByRole("heading", { name: "Dados financeiros" })).toBeVisible();
  await expect(page.getByLabel("Valor do tratamento")).toHaveValue(/R\$\s30\.000,00/);
  await expect(page.getByLabel("Renda mensal")).toHaveValue(/R\$\s3\.000,00/);
  await expect(page).toHaveURL(/\?step=financial&demo=1$/);
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Maria da Silva");
});

test("registration: instant errors, and fixing the fields moves forward on the first click", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("CPF").fill("52998224726");
  await page.getByLabel("CPF").blur();
  await expect(page.getByText("CPF inválido")).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Informe o nome completo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dados pessoais" })).toBeVisible();

  await fillPersonalData(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Dados financeiros" })).toBeVisible();
});

test("the header link starts the next patient with an empty form, not the previous patient's draft", async ({ page }) => {
  await register(page, { scenario: "delta-fails" });
  await page.getByRole("link", { name: /Parcela Mais/ }).click();
  await expect(page.getByRole("heading", { name: "Dados pessoais" })).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveValue("");
  await expect(page.getByLabel("CPF")).toHaveValue("");
});

test("a selection made in another tab is shown with a notice (409)", async ({ page, request }) => {
  await register(page, { scenario: "all-approve" });
  await expect(page.getByTestId("offer")).toHaveCount(12, { timeout: 10_000 });

  const id = page.url().split("/").pop();
  const other = await request.post(`/api/pre-approvals/${id}/selection`, { data: { lenderId: "gama", term: 10 } });
  expect(other.status()).toBe(201);

  await page.getByRole("button", { name: /Escolher Alfa em 12 parcelas/ }).click();
  await expect(page.getByText("Esta pré-aprovação já tinha outra oferta escolhida.", { exact: false })).toBeVisible();
  await expect(page.getByText(/10× de/)).toBeVisible();
});

test("if the live stream cannot even connect (network error), the safety polling still finishes the screen", async ({ page }) => {
  await page.route("**/api/pre-approvals/*/events", (route) => route.abort("failed"));
  await register(page, { scenario: "delta-fails" });

  await expect(lenderCard(page, "delta")).toHaveAttribute("data-status", "unavailable", { timeout: 15_000 });
  await expect(page.getByTestId("offer")).toHaveCount(9);
});

test("if the live stream fails, the screen falls back to polling and still finishes", async ({ page }) => {
  await page.route("**/api/pre-approvals/*/events", (route) => route.fulfill({ status: 503, body: "" }));
  await register(page, { scenario: "delta-fails" });

  await expect(lenderCard(page, "delta")).toHaveAttribute("data-status", "unavailable", { timeout: 12_000 });
  await expect(page.getByTestId("offer")).toHaveCount(9);
});
