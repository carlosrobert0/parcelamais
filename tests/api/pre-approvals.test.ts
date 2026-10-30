import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getEvents } from "@/app/api/pre-approvals/[id]/events/route";
import { GET as getPreApproval } from "@/app/api/pre-approvals/[id]/route";
import { POST as postSelection } from "@/app/api/pre-approvals/[id]/selection/route";
import { POST as postPreApproval } from "@/app/api/pre-approvals/route";
import { GET as getMetrics } from "@/app/api/metrics/route";
import type { Scenario } from "@/domain/scenarios";
import { createPreApprovalSchema } from "@/domain/schemas";
import type { PreApproval } from "@/domain/types";
import { sql } from "@/server/db/client";
import { completeStalePreApprovals, saveLenderOutcome } from "@/server/repository";
import { startPreApproval } from "@/server/run-pre-approval";

const { scheduled, unsubscribed } = vi.hoisted(() => ({ scheduled: [] as (() => Promise<void>)[], unsubscribed: vi.fn() }));

vi.mock("next/server", () => ({ after: (callback: () => Promise<void>) => scheduled.push(callback) }));

vi.mock("@/server/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/events")>();
  return {
    subscribeToPreApproval: async (id: string, onChange: () => void) => {
      const unsubscribe = await actual.subscribeToPreApproval(id, onChange);
      return async () => {
        await unsubscribe();
        unsubscribed(id);
      };
    },
  };
});

const patient = {
  name: "Maria da Silva",
  cpf: "529.982.247-25",
  birthDate: "1990-05-10",
  phone: "(11) 98765-4321",
  monthlyIncomeCents: 500_000,
  treatmentAmountCents: 1_000_000,
};

type PatientChanges = Partial<typeof patient>;

const jsonRequest = (body: unknown) =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });
const instantSleep = async () => {};

async function createViaApi(scenario: Scenario, changes: PatientChanges = {}) {
  const response = await postPreApproval(jsonRequest({ patient: { ...patient, ...changes }, scenario }));
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return id;
}

async function createAndComplete(scenario: Scenario, changes: PatientChanges = {}, random?: () => number) {
  const request = createPreApprovalSchema.parse({ patient: { ...patient, ...changes }, scenario });
  const { id, run } = await startPreApproval(request);
  await run({ sleep: instantSleep, random });
  return id;
}

async function fetchPreApproval(id: string): Promise<PreApproval> {
  return (await getPreApproval(new Request("http://test"), routeContext(id))).json();
}

const select = (id: string, body: unknown) => postSelection(jsonRequest(body), routeContext(id));

beforeEach(() => {
  scheduled.length = 0;
  unsubscribed.mockClear();
});

describe("POST /api/pre-approvals", () => {
  it("422 with a message for each invalid field", async () => {
    const response = await postPreApproval(jsonRequest({ patient: { ...patient, cpf: "111.111.111-11", treatmentAmountCents: 99_999 } }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      errors: { "patient.cpf": "CPF inválido", "patient.treatmentAmountCents": "O valor mínimo é R$\u00a01.000,00" },
    });
  });

  it("422 when the income does not fit the database column", async () => {
    const response = await postPreApproval(jsonRequest({ patient: { ...patient, monthlyIncomeCents: 3_000_000_000 } }));
    expect(response.status).toBe(422);
    expect((await response.json()).errors).toHaveProperty("patient.monthlyIncomeCents");
  });

  it("400 with a Portuguese message for a body that is not JSON", async () => {
    const response = await postPreApproval(new Request("http://test", { method: "POST", body: "{broken" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "O corpo da requisição não é um JSON válido" });
  });

  it("413 for a body above the size limit, before touching the database", async () => {
    const response = await postPreApproval(jsonRequest({ patient: { ...patient, name: `Maria ${"a".repeat(20_000)}` } }));
    expect(response.status).toBe(413);
    expect(await sql`select count(*)::int as count from patient`).toEqual([{ count: 0 }]);
  });

  it("422 (not 500) for a name with a NUL byte, so nothing reaches the database driver", async () => {
    const response = await postPreApproval(jsonRequest({ patient: { ...patient, name: "Maria\u0000 Silva" } }));
    expect(response.status).toBe(422);
  });

  it("default validation messages come in Portuguese", async () => {
    const response = await postPreApproval(jsonRequest({ patient, scenario: "xpto" }));
    expect(await response.json()).toEqual({ errors: { scenario: "Cenário inválido" } });
  });

  it("201 right away, with all 4 lenders pending and the orchestration scheduled for later", async () => {
    const id = await createViaApi("all-approve");
    expect(scheduled).toHaveLength(1);

    const preApproval = await fetchPreApproval(id);
    expect(preApproval.status).toBe("pending");
    expect(preApproval.results.map((result) => [result.lenderName, result.status])).toEqual([
      ["Alfa", "pending"],
      ["Beta", "pending"],
      ["Gama", "pending"],
      ["Delta", "pending"],
    ]);
  });

  it("the scheduled callback runs the requested scenario for the submitted patient", async () => {
    const id = await createViaApi("delta-fails");
    await scheduled[0]();

    const preApproval = await fetchPreApproval(id);
    expect(preApproval.status).toBe("completed");
    expect(preApproval.results.find((result) => result.lenderId === "delta")).toMatchObject({ status: "unavailable", reason: "error" });
    expect(preApproval.offers).toHaveLength(9);
  });

  it("the same CPF reuses the patient and updates its data", async () => {
    await createViaApi("all-approve");
    await createViaApi("all-approve", { monthlyIncomeCents: 900_000 });
    expect(await sql`select monthly_income_cents from patient`).toEqual([{ monthly_income_cents: 900_000 }]);
  });
});

describe("GET /api/pre-approvals/:id", () => {
  it("404 for an unknown or malformed id", async () => {
    expect((await getPreApproval(new Request("http://test"), routeContext("not-a-uuid"))).status).toBe(404);
    expect((await getPreApproval(new Request("http://test"), routeContext("00000000-0000-4000-8000-000000000000"))).status).toBe(404);
  });

  it("random scenario applies the real rules to the submitted patient (age and income reach the lenders)", async () => {
    const id = await createAndComplete(
      "random",
      { birthDate: "2004-05-10", monthlyIncomeCents: 300_000, treatmentAmountCents: 4_000_000 },
      () => 0.5,
    );
    const results = Object.fromEntries((await fetchPreApproval(id)).results.map((result) => [result.lenderId, result]));

    expect(results.alfa).toMatchObject({ status: "declined", reason: expect.stringContaining("Renda × 10") });
    expect(results.beta).toMatchObject({ status: "approved", approvedAmountCents: 2_400_000 });
    expect(results.gama).toMatchObject({ status: "declined", reason: "Paciente com menos de 25 anos" });
    expect(results.delta).toMatchObject({ status: "approved", approvedAmountCents: 4_000_000 });
  });

  it("all-approve: completed with 12 offers, Beta flagged as partial and no suggestion", async () => {
    const id = await createAndComplete("all-approve", { monthlyIncomeCents: 300_000, treatmentAmountCents: 4_000_000 });

    const preApproval = await fetchPreApproval(id);
    expect(preApproval.status).toBe("completed");
    expect(preApproval.results.every((result) => result.status === "approved")).toBe(true);
    expect(preApproval.offers).toHaveLength(12);
    const betaOffers = preApproval.offers.filter((offer) => offer.lenderId === "beta");
    expect(betaOffers.every((offer) => offer.partial && offer.approvedAmountCents === 2_400_000)).toBe(true);
    expect(preApproval.suggestedAmountCents).toBeNull();
  });

  it("none-approve: no offers, a reason per lender and a lower amount suggestion (income × 10)", async () => {
    const id = await createAndComplete("none-approve", { monthlyIncomeCents: 300_000, treatmentAmountCents: 4_000_000 });
    const preApproval = await fetchPreApproval(id);
    expect(preApproval.offers).toEqual([]);
    expect(preApproval.results.every((result) => result.status === "declined" && result.reason)).toBe(true);
    expect(preApproval.suggestedAmountCents).toBe(3_000_000);
  });

  it("the suggestion keeps using the income from that pre-approval after the patient is updated", async () => {
    const id = await createAndComplete("none-approve", { monthlyIncomeCents: 300_000, treatmentAmountCents: 4_000_000 });
    await createViaApi("all-approve", { monthlyIncomeCents: 200_000 });
    expect((await fetchPreApproval(id)).suggestedAmountCents).toBe(3_000_000);
  });

  it("a pre-approval stuck as pending past the deadline is completed when read", async () => {
    const id = await createViaApi("all-approve");
    await sql`update pre_approval set created_at = now() - interval '1 minute' where id = ${id}`;

    const preApproval = await fetchPreApproval(id);
    expect(preApproval.status).toBe("completed");
    expect(preApproval.results.every((result) => result.status === "unavailable" && result.reason === "error")).toBe(true);
  });
});

describe("deadline", () => {
  it("counts the 15s from creation, even when the run starts late, and completes with a lender that never answers", async () => {
    const neverForDelta = (ms: number) => (ms >= 4_000 ? new Promise<void>(() => {}) : Promise.resolve());
    const { id, run } = await startPreApproval(createPreApprovalSchema.parse({ patient, scenario: "random" }));
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await run({ sleep: neverForDelta, random: () => 0.5 });

    const [{ elapsedMs }] = await sql`select extract(epoch from completed_at - created_at) * 1000 as "elapsedMs" from pre_approval where id = ${id}`;
    expect(Number(elapsedMs)).toBeGreaterThan(14_000);
    expect(Number(elapsedMs)).toBeLessThan(15_100);
    const delta = (await fetchPreApproval(id)).results.find((result) => result.lenderId === "delta");
    expect(delta).toMatchObject({ status: "unavailable", reason: "timeout" });
  });
});

describe("GET /api/metrics", () => {
  it("only counts real (random) pre-approvals, not forced demo scenarios", async () => {
    await createAndComplete("all-approve");
    await createAndComplete("random", {}, () => 0.5);
    const rows = await (await getMetrics()).json();
    expect(rows.map((row: { lenderId: string; requests: number }) => [row.lenderId, row.requests])).toEqual([
      ["alfa", 1],
      ["beta", 1],
      ["delta", 1],
      ["gama", 1],
    ]);
  });
});

describe("conditional writes and recovery", () => {
  it("a late response never overwrites a lender that already has an outcome", async () => {
    const id = await createViaApi("all-approve");
    await saveLenderOutcome(id, "delta", { status: "unavailable", reason: "timeout", latencyMs: 10_000 });
    await saveLenderOutcome(id, "delta", { status: "approved", approvedAmountCents: 1, monthlyRate: 0.02, terms: [12], latencyMs: 15_000 });

    const delta = (await fetchPreApproval(id)).results.find((result) => result.lenderId === "delta");
    expect(delta).toMatchObject({ status: "unavailable", reason: "timeout", latencyMs: 10_000 });
  });

  it("stale pre-approvals (process died mid-run) are completed on startup, recent ones are left alone", async () => {
    const staleId = await createViaApi("all-approve");
    await sql`update pre_approval set created_at = now() - interval '1 minute' where id = ${staleId}`;
    const recentId = await createViaApi("all-approve");

    expect(await completeStalePreApprovals()).toBe(1);
    expect((await sql`select status from pre_approval where id = ${staleId}`)[0].status).toBe("completed");
    expect((await fetchPreApproval(recentId)).status).toBe("pending");
  });
});

describe("POST /api/pre-approvals/:id/selection", () => {
  it("409 while the pre-approval is still running", async () => {
    const id = await createViaApi("all-approve");
    expect((await select(id, { lenderId: "alfa", term: 12 })).status).toBe(409);
  });

  it("201 on the first selection, with installment and total recalculated on the server", async () => {
    const id = await createAndComplete("all-approve");
    const response = await select(id, { lenderId: "alfa", term: 12, installmentCents: 1 });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      lenderId: "alfa",
      lenderName: "Alfa",
      term: 12,
      installmentCents: 97_428,
      totalCents: 97_428 * 12,
      uncoveredCents: 0,
    });
    expect((await fetchPreApproval(id)).selection).toMatchObject({ lenderId: "alfa", term: 12 });
  });

  it("repeating the same selection is idempotent (200); choosing another one is a conflict (409)", async () => {
    const id = await createAndComplete("all-approve");
    await select(id, { lenderId: "alfa", term: 12 });

    expect((await select(id, { lenderId: "alfa", term: 12 })).status).toBe(200);
    const conflict = await select(id, { lenderId: "beta", term: 24 });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ selection: { lenderId: "alfa", term: 12 } });
  });

  it("422 for a term the lender does not offer, a lender that did not approve, or a missing field", async () => {
    const id = await createAndComplete("delta-fails");
    expect((await select(id, { lenderId: "alfa", term: 7 })).status).toBe(422);
    expect((await select(id, { lenderId: "delta", term: 12 })).status).toBe(422);
    expect((await select(id, { lenderId: "alfa" })).status).toBe(422);
  });
});

describe("GET /api/pre-approvals/:id/events (SSE)", () => {
  async function readSnapshots(response: Response, onSnapshot: (snapshot: PreApproval) => void) {
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = event.split("\n").find((line) => line.startsWith("data: "));
        if (event.startsWith("event: snapshot") && data) onSnapshot(JSON.parse(data.slice(6)));
      }
    }
  }

  it("404 for an unknown pre-approval, so the browser does not keep reconnecting", async () => {
    const response = await getEvents(new Request("http://test"), routeContext("00000000-0000-4000-8000-000000000000"));
    expect(response.status).toBe(404);
  });

  it("sends a snapshot on connect, one per database change (NOTIFY trigger) and closes when completed", async () => {
    const request = createPreApprovalSchema.parse({ patient, scenario: "all-approve" });
    const { id, run } = await startPreApproval(request);
    const response = await getEvents(new Request("http://test"), routeContext(id));
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const received: PreApproval[] = [];
    const reading = readSnapshots(response, (snapshot) => received.push(snapshot));

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].status).toBe("pending");

    await run({ sleep: instantSleep });
    await reading;

    const last = received.at(-1)!;
    expect(last.status).toBe("completed");
    expect(last.offers).toHaveLength(12);
    expect(received.length).toBeGreaterThan(2);
  });

  it("an upper-case id in the URL still receives every change", async () => {
    const { id, run } = await startPreApproval(createPreApprovalSchema.parse({ patient, scenario: "all-approve" }));
    const response = await getEvents(new Request("http://test"), routeContext(id.toUpperCase()));
    const received: PreApproval[] = [];
    const reading = readSnapshots(response, (snapshot) => received.push(snapshot));
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await run({ sleep: instantSleep });
    await reading;
    expect(received.at(-1)!.status).toBe("completed");
    expect(received.length).toBeGreaterThan(2);
  });

  it("an already completed pre-approval sends one snapshot and closes (reloading the page afterwards)", async () => {
    const id = await createAndComplete("delta-fails");
    const received: PreApproval[] = [];
    await readSnapshots(await getEvents(new Request("http://test"), routeContext(id)), (snapshot) => received.push(snapshot));
    expect(received.map((snapshot) => snapshot.status)).toEqual(["completed"]);
  });

  it("stops listening when the client disconnects", async () => {
    const { id } = await startPreApproval(createPreApprovalSchema.parse({ patient, scenario: "all-approve" }));
    const client = new AbortController();
    const response = await getEvents(new Request("http://test", { signal: client.signal }), routeContext(id));
    const reader = response.body!.getReader();
    await reader.read();

    expect(unsubscribed).not.toHaveBeenCalled();
    client.abort();
    await vi.waitFor(() => expect(unsubscribed).toHaveBeenCalledWith(id));
  });
});
