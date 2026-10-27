export const SCENARIOS = ["random", "all-approve", "delta-fails", "delta-timeout", "none-approve"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Record<Scenario, string> = {
  random: "Aleatório (comportamento real)",
  "all-approve": "Todas aprovam",
  "delta-fails": "Delta falha (erro 500)",
  "delta-timeout": "Delta estoura o tempo",
  "none-approve": "Nenhuma aprova",
};
