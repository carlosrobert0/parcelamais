# Parcela Mais · Pré-aprovação em várias financeiras

A clínica cadastra o paciente uma vez. O backend consulta 4 financeiras simuladas **em paralelo**, com prazo máximo de **10 segundos**. A tela mostra o status de cada uma ao vivo e, no fim, as ofertas pela Tabela Price. A oferta escolhida é salva no backend.

**Stack:** Next.js 16 (App Router, front + API num app só) · React 19 + TypeScript strict · Tailwind + shadcn/ui · react-hook-form + zod (o mesmo schema no front e na API) · TanStack Query · PostgreSQL 16 + Drizzle · SSE + Postgres `LISTEN/NOTIFY` · Vitest + Testing Library + Playwright · Docker Compose.

## Como rodar

```bash
docker compose up --build
```

Abra http://localhost:3000. Para escolher o cenário, use **http://localhost:3000/?demo=1**: aparece um seletor no passo de revisão.

As migrations rodam sozinhas quando o servidor sobe. O compose publica as portas 3000 e 5432; se já houver um Postgres local na 5432, pare-o antes.

<details>
<summary>Rodar fora do Docker (dev) e testes</summary>

```bash
docker compose up -d db      # só o Postgres (cria também o banco de teste)
npm install
npm run dev                  # http://localhost:3000

npm test                     # Vitest: unidade + componentes + API (contra o Postgres de teste)
npx playwright install chromium   # só na primeira vez
npm run e2e                  # Playwright: os 4 cenários na UI (sobe o dev server se preciso)
npm run lint && npm run typecheck
```
</details>

## Forçar os cenários

Pela UI: `/?demo=1` e escolha o cenário na revisão. Pela API:

```bash
curl -s localhost:3000/api/pre-approvals -H 'content-type: application/json' -d '{
  "scenario": "delta-timeout",
  "patient": { "name": "Maria da Silva", "cpf": "529.982.247-25", "birthDate": "1990-05-10",
               "phone": "11987654321", "monthlyIncomeCents": 500000, "treatmentAmountCents": 1000000 }
}'
# → {"id":"…"}
curl -N localhost:3000/api/pre-approvals/<id>/events   # acompanha ao vivo (SSE)
```

| `scenario` | O que acontece |
|---|---|
| `random` (padrão) | Comportamento real: latências sorteadas, Delta com 30% de erro 500 e até 15s |
| `all-approve` | As 4 aprovam (Delta aos 4,5s) |
| `delta-fails` | Delta responde erro 500 → indisponível; as outras aprovam |
| `delta-timeout` | Delta responderia aos 15s → é cortada aos 10s e fica indisponível; se a resposta chegasse depois, seria descartada |
| `none-approve` | As 4 recusam (com o motivo real da regra quando ela também recusaria) → a tela explica e oferece "tentar com valor menor" |

O código está em inglês (pastas, identificadores, banco, API); textos de tela e mensagens para o usuário, em português.

## Arquitetura

```
src/
  domain/             regras puras: sem Next, sem banco (é o que os testes de unidade cobrem)
    cpf.ts age.ts price.ts offers.ts suggestion.ts schemas.ts scenarios.ts types.ts format.ts text.ts deadline.ts
    lenders/          alfa.ts beta.ts gama.ts delta.ts (montadas por create-lender.ts) e scenario-overrides.ts
    orchestrator.ts   paralelo + prazo global; grava por uma "porta" (save), não conhece o banco
  server/             infraestrutura: Drizzle, repository, LISTEN (events), SSE (snapshot-stream), http, logger
    run-pre-approval.ts   liga o orquestrador ao banco e ao log, com o prazo contado desde a criação
  app/                páginas e route handlers (finos: validam, chamam o server, respondem)
  features/           registration/, pre-approval/, offers/ (componentes + hooks de cada etapa)
  components/ui/      design system (shadcn/ui sobre Radix)
drizzle/              migrations versionadas (inclui o trigger do NOTIFY)
tests/api/            route handlers chamados direto contra um Postgres de teste
e2e/                  Playwright
```

```
POST /api/pre-approvals ─► zod ─► grava patient + pre_approval + 4× lender_result("pending")  ─► 201 {id}
                          └─► after(): orchestrate() roda depois da resposta
orchestrate: 4 financeiras em paralelo, UM AbortController de 10s
  resposta      → UPDATE … WHERE status='pending'  ─► trigger ─► pg_notify('pre_approval_<id>')
  erro 500      → unavailable/error
  passou de 10s → unavailable/timeout (a promessa da financeira é abandonada)
  fim           → pre_approval 'completed' ─► pg_notify
GET /api/pre-approvals/:id/events (SSE): LISTEN ─► snapshot ─► um snapshot por NOTIFY (e a cada 15s) ─► fecha ao concluir
```

### API

| Método | Rota | Corpo → resposta |
|---|---|---|
| `POST` | `/api/pre-approvals` | `{ patient, scenario? }` → `201 {id}` · `422 {errors: {"patient.cpf": "CPF inválido", …}}` |
| `GET` | `/api/pre-approvals/:id` | Snapshot: `{ id, status, scenario, treatmentAmountCents, createdAt, deadlineAt, results[], offers[], selection, suggestedAmountCents }` · `404` |
| `GET` | `/api/pre-approvals/:id/events` | SSE, evento `snapshot` (mesmo formato do GET) a cada mudança e a cada 15s; fecha ao concluir · `404` |
| `POST` | `/api/pre-approvals/:id/selection` | `{lenderId, term}` → `201` (salva) · `200` (mesma escolha de novo) · `409` (já há outra / ainda em andamento) · `422` (oferta inexistente) |
| `GET` | `/api/metrics` | Por financeira: % aprovação/recusa/erro/timeout e latência p50/p95 |

Dinheiro sempre em **centavos inteiros** (API, banco e domínio). Taxa em `numeric(6,4)`.

### Banco

`patient` (CPF único) → `pre_approval` (valor do tratamento, **renda e idade usadas naquela consulta**, cenário, status) → `lender_result` (uma linha por financeira, `UNIQUE(pre_approval_id, lender_id)`, com status, motivo, valor aprovado, taxa, prazos e latência) e `selected_offer` (`UNIQUE(pre_approval_id)`, com parcela e total recalculados no servidor).

## Decisões e trade-offs

**SSE + `LISTEN/NOTIFY`, em vez de polling ou WebSocket.** Aqui só o servidor fala, então WebSocket seria bidirecional à toa. Polling funcionaria, mas com mais requisições e latência. O SSE é HTTP puro, tem reconexão nativa e manda um snapshot ao conectar, então recarregar a página no meio da consulta continua de onde parou. O aviso sai de um **trigger no banco**: funciona com várias instâncias do app (o SSE pode estar numa instância e a orquestração em outra) e nenhum código esquece de notificar. Trade-off: o LISTEN precisa de conexão direta com o Postgres (não passa por pooler em modo transaction).

**Um evento só (`snapshot`).** O NOTIFY leva só o status; o SSE relê a pré-aprovação inteira. São ~6 snapshots por consulta (cada um com 3 SELECTs), por cliente conectado. Em troca, o front só substitui o estado (sem merge) e não existe "evento perdido". As leituras são serializadas para um snapshot antigo nunca chegar depois de um novo. O LISTEN é refeito se a conexão com o Postgres cair, e um snapshot sai também a cada 15s (heartbeat), então nem um NOTIFY perdido trava a tela. Se o SSE falhar de vez (ex.: proxy devolvendo 502), o front cai para polling a cada 2s.

**Prazo global de 10s, não 10s por financeira, contado desde a criação.** A clínica espera no máximo 10s pela consulta inteira. Um `AbortController` aborta tudo no prazo, e `withinDeadline()` rejeita mesmo que a financeira ignore o sinal. Quem não respondeu vira *indisponível/timeout*. O relógio começa no `created_at` (não quando o `after()` roda) e a conclusão é forçada no prazo mesmo que uma gravação trave; medido com 150 consultas simultâneas, todas concluíram entre 9,80s e 9,82s após a criação.

**Resposta tardia nunca sobrescreve.** A gravação é condicional (`UPDATE … WHERE status = 'pending'`). Isso protege contra corrida e dá idempotência ao mesmo tempo. Há teste disso na unidade (o orquestrador não grava de novo) e no banco (o `UPDATE` não sobrescreve).

**Falha isolada.** `Promise.allSettled` + `try/catch` por financeira. Erro 500, exceção síncrona ou falha ao gravar uma financeira não afetam as outras; a gravação tenta de novo (3 vezes) antes de desistir. No fim, `completePreApproval()` garante que nada fica em `pending` para sempre.

**Entrada e erros da API.** Corpo limitado a 16 KB (413), JSON inválido → 400, validação → 422 por campo, tudo com mensagem em português (o zod usa o locale `ptBR`). Erro inesperado vira JSON 500 (ou 503 se a conexão com o banco caiu) e o log leva só o código do erro: nunca nome, CPF ou celular.

**`after()` do Next em vez de fila.** O POST responde em milissegundos e a orquestração roda depois, no mesmo processo. Trade-off: se o processo cair no meio, a pré-aprovação fica órfã. Duas redes de segurança: uma varredura ao subir e um fechamento "preguiçoso" na leitura, ambos só para quem passou de 30s (3 × o prazo, para não pegar uma que outra instância ainda está orquestrando). Em produção eu usaria uma fila (pg-boss/SQS) chamando o **mesmo** `runPreApproval()`, sem mudar o domínio.

**Domínio puro (`src/domain`).** Regras, financeiras e orquestrador não importam Next nem banco; `sleep`, `random` e o relógio (`now`) são injetáveis. Por isso os testes do orquestrador usam timers falsos e rodam em milissegundos. As financeiras são declarativas (`createLender({ latencyMs, monthlyRate, terms, errorRate, evaluate })`): uma financeira nova é um arquivo + uma linha em `lenders/index.ts`, e os cenários forçados já a incluem (são derivados da lista).

**O servidor recalcula a oferta escolhida.** O cliente manda só `{lenderId, term}`; parcela e total vêm do servidor. Não dá para gravar um valor inventado.

**Front: a URL é o estado da jornada.** `/pre-approvals/:id` reconstrói tudo do servidor (retomar após recarregar sai quase de graça). O cadastro é **um** `useForm` para os 3 passos (voltar não perde nada), com validação por passo, rascunho na `sessionStorage` (limpo ao começar o próximo paciente) e o **mesmo schema zod da API**. Erros 422 da API voltam para o campo certo, no passo certo, com o foco nele. Depois do envio o botão fica travado até a navegação terminar (nada de duas pré-aprovações por clique duplo). Na tela ao vivo, além do SSE, um polling de segurança (5s, ou 2s se o SSE caiu) garante que a tela termina mesmo com proxy ou rede ruins. As regras das financeiras não vão para o navegador.

**Drizzle em vez de Prisma.** O `LISTEN` vem no mesmo driver (postgres.js), o schema se lê como SQL e não há geração de client (o `drizzle-kit` só gera as migrations).

**Next.js full stack em vez de front + API separados.** Um deploy só e o front em destaque. O risco (tarefa em segundo plano dentro do Next) está tratado acima.

### Interpretações do enunciado

- A **Beta sempre aprova**, então "nenhuma aprova" não acontece com as regras reais: os cenários forçados podem sobrescrever a regra (forçar recusa/erro/aprovação) e fixam a latência.
- Idade 18–80 **inclusive**; "hoje" no fuso de São Paulo; quem nasceu em 29/02 faz aniversário em 01/03 nos anos não bissextos.
- Beta "no máximo 60%": arredonda para baixo.
- **Menor parcela** compara a parcela de cada oferta (a Beta, que financia 60%, costuma ganhar; por isso o selo **Parcial**). **Menor custo total** soma ao total financiado o que fica de fora (`totalCostCents = total + (tratamento − aprovado)`): é o que o paciente gasta de fato, e assim uma aprovação parcial não parece mais barata só por financiar menos.
- A oferta só pode ser escolhida depois que a consulta conclui (≤ 10s).
- Sugestão de "valor menor": `renda × 10` (o que a Alfa aprovaria), quando é menor que o pedido.

## Testes

| Camada | O que cobre |
|---|---|
| Domínio (Vitest) | CPF (DVs, resto 10, repetidos, formato), nome (tamanho, caracteres invisíveis, sobrenome), idade (18 no dia/véspera, 80/81, 29/02, fuso de SP), Price (valores conferidos, taxa 0, a parcela quita a dívida), **taxa, prazos e faixa de latência de cada financeira**, regras **nos limites** (Alfa `renda×10 == valor`, Gama 24/25 anos e R$ 20.000,00/20.000,01, Beta 60% arredondado para baixo), cenários, ordenação com empates e com ofertas parciais, máscaras |
| Orquestrador (timers falsos) | paralelo, grava ao chegar, termina sem esperar o prazo, erro isolado, exceção síncrona isolada, **timeout aos 10s exatos**, **resposta tardia ignorada**, falha ao gravar isolada, os 5 cenários com as financeiras reais (incluindo a Delta sorteando 15s) |
| API (Postgres real) | 400/413/422 com mensagens em português (inclusive renda acima do limite e byte NUL), **prazo contado desde a criação com uma financeira que nunca responde**, métricas só do cenário real, 201 + **o callback do `after()` executado**, **regras reais ponta a ponta** (idade e renda chegando às financeiras), upsert do paciente sem reescrever o histórico, **gravação condicional**, órfãs e fechamento preguiçoso, escolha (201/200/409/422, recálculo no servidor), **SSE com trigger NOTIFY** do primeiro snapshot até fechar, 404 e desinscrição ao desconectar |
| Componentes | erro na hora, erro some ao corrigir, não avança inválido, **dois envios no mesmo instante avançam um passo só**, voltar preserva, moeda apagável, "Editar" foca o campo, 422 da API no campo e passo certos (com foco), **sem duplo envio**, rascunho + valor sugerido, novo paciente limpa o form, confirmação limpa o rascunho e avisa financiamento parcial, tela "nenhuma aprovou" (mantendo o modo demo) |
| E2E (Playwright) | os 4 cenários de ponta a ponta, validação do cadastro, novo paciente sem o rascunho anterior, 409 de outra aba, **SSE devolvendo 503 ou com erro de rede → a tela termina por polling**; roda também contra o container de produção |

Total: 153 testes Vitest + 9 E2E. Os testes críticos foram checados com mutação (o código foi quebrado de propósito para confirmar que o teste falha).

## Performance e acessibilidade

Lighthouse na página inicial (build de produção, emulação mobile): **Performance 97 · Acessibilidade 100 · Boas práticas 100**, CLS 0.

Componentes Radix/shadcn, labels e erros ligados por `aria-describedby`/`aria-invalid`, foco no título a cada passo, status das financeiras anunciado por `aria-live`, ordenação com `aria-pressed`, tudo operável por teclado.

## Tempo investido

Cerca de **6h** de implementação, testes e revisão (27/10, das 10h30 às 16h40), com o planejamento (stack, contrato, modelo do banco e plano de testes) feito antes. Ao chegar nas 6h parei de adicionar funcionalidades; o que eu faria em seguida está logo abaixo.

## O que ficou de fora / com mais tempo

- **Fila** (pg-boss/SQS) no lugar do `after()`, com retry e o mesmo `runPreApproval()`.
- **Resiliência por financeira:** circuit breaker (não chamar quem está fora), retry com orçamento dentro dos 10s, feature flag para ligar/desligar uma financeira sem deploy.
- **Migrations com lock** (ou job separado) para várias instâncias subirem juntas.
- **Cenários forçados** atrás de uma flag de ambiente (hoje qualquer cliente pode mandar `scenario`).
- **LGPD:** CPF cifrado em repouso, retenção, mascaramento. Hoje o log já não leva CPF, nome nem celular.
- **Observabilidade:** OpenTelemetry (trace por consulta com span por financeira), painel para `/api/metrics`, alertas de taxa de erro.
- **Cadastro do paciente versionado:** hoje o paciente é um registro por CPF e o último envio atualiza nome/celular (renda e idade usadas em cada consulta ficam congeladas na própria pré-aprovação).
- **Passo do formulário na URL**, para o "voltar" do navegador navegar entre passos (hoje os dados são preservados, mas o voltar sai do formulário). Máscara de CPF que preserve o cursor ao editar no meio.
- Versionamento do contrato da API, autenticação da clínica, deploy público.

## Como isso ficaria no Xano

O domínio foi separado justamente para isso. No Xano, `POST /pre-approvals` seria uma *function stack*: validar (as mesmas regras de `schemas.ts`), gravar as tabelas e disparar uma **background task** que chama as 4 integrações em paralelo (*Group* de requests externas com timeout) e grava cada resultado com a mesma condição `status = 'pending'`. Os status ao vivo poderiam vir do **Realtime** do Xano (um canal por pré-aprovação) no lugar do SSE, ou de polling no snapshot. Price, ordenação e sugestão são funções puras e viram *custom functions* reutilizáveis.

## Como usei IA

Trabalhei com o Claude Code de forma **guiada por especificação**: a IA escreve e verifica o código, mas dentro de uma spec e de regras que eu defini. Nada entra sem teste, e toda decisão precisa ser algo que eu consiga explicar e alterar ao vivo.

**1. Spec antes do código.** Antes de qualquer linha de código, montei com a IA uma especificação (fora do repositório) e a usei como contrato do trabalho:
- **stack com alternativas comparadas** (prós, contras e veredito): Vite + Fastify, Next.js full stack, Supabase e NestJS. Escolhi Next.js full stack com o domínio isolado do framework, e Drizzle em vez de Prisma por causa do `LISTEN/NOTIFY` no mesmo driver;
- **arquitetura**: domínio puro, orquestrador com uma porta de gravação (sem conhecer o banco), tempo real com SSE + `LISTEN/NOTIFY` em vez de polling ou WebSocket, e a URL como estado da jornada;
- **contrato da API e modelo do banco**: rotas, códigos de status (201/200/409/422), tabelas e constraints;
- **regras de negócio** tiradas do enunciado numa tabela, com as **interpretações dos pontos ambíguos** registradas (ex.: a Beta sempre aprova, então "nenhuma aprova" precisa de cenário forçado);
- **plano de testes por camada** e um checklist em 5 blocos com estimativa de tempo.

**2. Regras que eu dei para a IA seguir.**
- Código pequeno e óbvio, sem abstração desnecessária, porque eu vou alterá-lo ao vivo.
- Dinheiro sempre em centavos inteiros; regra de negócio só em `src/domain`, sem importar Next nem banco.
- Testes cobrindo o que pode quebrar (timeout, falha, limites das regras), não só o caminho feliz.
- Ao fim de cada bloco, um resumo das decisões que eu precisaria defender.
- Não reabrir a stack sem um motivo forte.

**3. Execução em blocos, cada um com testes:** fundação (Next, Docker, banco e migrations) → domínio puro → backend e tempo real → front → entrega.

**4. Verificação além dos testes verdes.** A IA testou a API com `curl` e um consumidor SSE, dirigiu a UI com Playwright tirando screenshots no desktop e no celular, subiu o `docker compose` do zero e rodou o Lighthouse. Foi assim que apareceram bugs que os testes ainda não pegavam:
- o trigger do NOTIFY usava `CASE`, que no PL/pgSQL resolve o campo dos dois ramos e travava a conclusão da consulta (trocado por `IF`; desde então os testes de API rodam contra o Postgres real);
- um campo com erro só revalidava no blur, e o blur no `mousedown` do botão fazia a mensagem sumir, o botão subir e o clique se perder.

**5. Code review independente, em rodadas.** Agentes revisores separados, cada um com um recorte e sem receber as minhas conclusões:
- backend e concorrência; front, estado e acessibilidade; regras de negócio contra o enunciado;
- qualidade dos testes **com testes de mutação** (o código é quebrado de propósito para ver se algum teste falha): 7 de 15 mutações passavam despercebidas, e cada uma ganhou um teste específico;
- padrões de código; prontidão para entrega;
- caça a bugs com carga e entradas hostis: 800 POSTs simultâneos, 1.000 clientes SSE, slowloris, corpo de 100 MB, byte NUL.

Cada achado foi reproduzido antes de ser corrigido e ganhou um teste de regressão. Entre eles:
- tela presa se o SSE falhasse (agora há polling de segurança);
- clique duplo criando duas pré-aprovações;
- o rascunho do paciente anterior aparecendo para o próximo;
- dados do paciente vazando para o log num erro de banco;
- o prazo de 10s escorregando sob carga;
- a ordenação por custo total favorecendo quem aprova menos.

**6. Padrões que eu impus depois da revisão.**
- Código todo em inglês, sem comentários e com clean code; só o conteúdo de tela em português.
- Só o essencial versionado, com commits atômicos no padrão Conventional Commits.
- Ensaio do avaliador: clonar o repositório numa pasta limpa e subir com um único comando.

**Onde a IA errou e foi corrigida.**
- Uma expectativa errada num teste E2E: o código estava certo e o teste, não.
- Um teste do prazo que passaria mesmo com o código antigo; foi refeito e validado por mutação.
- Uma dependência removida por engano, que o typecheck pegou na hora.

É por isso que nada entra sem teste e revisão.

**O que é meu:** as escolhas de arquitetura e de produto, a interpretação do enunciado, as regras acima, a revisão do código e a responsabilidade de explicar e alterar cada parte ao vivo.
