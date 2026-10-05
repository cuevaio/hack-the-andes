# Power Grid

Power Grid is challenge 4, an undocumented electricity billing service. Its
rules are fictional and personalized; no real tariff knowledge is required.
Use the server's authenticated availability rather than assuming the public
opening date also applies to an admin with early access.

Start with read-only status and setup:

```sh
andes --output json challenge show --challenge power-grid
andes --output json challenge init --challenge power-grid
andes --output json challenge notebook --challenge power-grid --format json
```

Read `power-grid/README.md` and `power-grid/AGENTS.md` before solving. Existing
folders are preserved by init; if AGENTS.md is absent, follow the participant
direction checkpoints in SKILL.md. Each independent input has five required
fields: consumptionKwh, demandKw, hour, solar, and business. Output is integer
cents. The budgets are 25 successful distinct queries and three evaluations.

Before the first experiment, ask the participant what they want to investigate.
For example: "Podemos explorar cómo cambia el importe con el consumo o comparar
una lectura en distintos horarios. ¿Qué prefieres investigar primero?" Explain
the selected round's hypothesis and inputs, then run at most three new queries.
After the results, ask for the next direction and wait. The agent can propose
options and perform the arithmetic; the participant controls the next round.

```sh
andes --output json challenge query --challenge power-grid --input input.json
andes --output json challenge test --challenge power-grid --source ./bill.js
andes --output json challenge evaluate --challenge power-grid --source ./bill.js
```

Implement only the agreed change in calculateBill(input). Free tests compare
with collected observations, not additional hidden cases. Label inferred rules
and untested guesses separately when discussing results. Ask for a fresh decision
before each official evaluation and pause after its result before revising code.
Power Grid needs no review.json or browser approval. Skill checkpoints are
conversation instructions, not server-enforced authorization.
