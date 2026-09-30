export const brokenAgentScaffoldDirectory = "broken-agent" as const;
export const brokenAgentSolutionPath =
  `${brokenAgentScaffoldDirectory}/scheduler.js` as const;

export const brokenAgentPackageJson = `${JSON.stringify(
  {
    name: "broken-agent-challenge",
    private: true,
    type: "commonjs",
    scripts: { test: "node --test scheduler.test.js" },
  },
  null,
  2,
)}\n`;

export const brokenAgentStarterSource = `/**
 * Broken Agent — The Scheduler
 *
 * Un agente de código implementó este scheduler y declaró la tarea terminada.
 * Todos los tests públicos pasan, pero todavía hay fallas sutiles de producción.
 * Mantén intacta la interfaz createScheduler y endurece la implementación.
 */
function createScheduler({ store, clock, execute, workerId }) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const canonical = (value) => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    const entries = Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + canonical(value[key]),
    );
    return "{" + entries.join(",") + "}";
  };
  const isJsonValue = (value) => {
    if (value === null) return true;
    if (["string", "boolean"].includes(typeof value)) return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(value).every(isJsonValue);
  };
  const isIsoTimestamp = (value) => {
    if (typeof value !== "string") return false;
    const match = value.match(
      /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,3})?(?:Z|([+-])(\\d{2}):(\\d{2}))$/,
    );
    if (!match) return false;
    const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
    const values = [year, month, day, hour, minute, second, offsetHour || "0", offsetMinute || "0"].map(Number);
    const [yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, offsetHourValue, offsetMinuteValue] = values;
    const maximumDay = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
    return monthValue >= 1 && monthValue <= 12 &&
      dayValue >= 1 && dayValue <= maximumDay &&
      hourValue <= 23 && minuteValue <= 59 && secondValue <= 59 &&
      offsetHourValue <= 23 && offsetMinuteValue <= 59 &&
      Number.isFinite(Date.parse(value));
  };
  const ordered = (jobs) => jobs.sort((left, right) =>
    Date.parse(left.runAt) - Date.parse(right.runAt) ||
    left.id.localeCompare(right.id),
  );
  const normalize = (input) => {
    if (!input || typeof input !== "object") throw new Error("Job is required");
    if (typeof input.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(input.id)) {
      throw new Error("Job id is invalid");
    }
    if (
      !isIsoTimestamp(input.runAt)
    ) throw new Error("runAt must include an explicit timezone");
    if (!isJsonValue(input.payload)) throw new Error("payload must be JSON");
    return {
      id: input.id,
      runAt: input.runAt,
      payload: clone(input.payload),
      status: "pending",
      attempts: 0,
    };
  };

  return {
    async schedule(input) {
      const requested = normalize(input);
      return store.transaction((tx) => {
        const existing = tx.get(requested.id);
        if (!existing) {
          tx.put(requested);
          return clone(requested);
        }
        const identical =
          existing.runAt === requested.runAt &&
          canonical(existing.payload) === canonical(requested.payload);
        if (!identical) throw new Error("A different job already uses this id");
        return clone(existing);
      });
    },

    async cancel(id) {
      return store.transaction((tx) => {
        const job = tx.get(id);
        if (!job || job.status !== "pending") return false;
        tx.put({ ...job, status: "cancelled" });
        return true;
      });
    },

    async list() {
      const jobs = await store.transaction((tx) => tx.list());
      return ordered(jobs).map(clone);
    },

    async runDue() {
      const visited = new Set();
      while (true) {
        const now = clock.now().getTime();
        const claimed = await store.transaction((tx) => {
          for (const job of tx.list()) {
            if (
              job.status === "running" &&
              typeof job.leaseUntil === "number" &&
              job.leaseUntil < now
            ) {
              tx.put({ ...job, status: "pending" });
            }
          }
          const due = ordered(tx.list()).find((job) =>
            job.status === "pending" &&
            !visited.has(job.id) &&
            Date.parse(job.runAt) <= now,
          );
          if (!due) return undefined;
          const running = {
            ...due,
            status: "running",
            attempts: due.attempts + 1,
            owner: workerId,
            leaseUntil: now + 30_000,
          };
          tx.put(running);
          return running;
        });
        if (!claimed) return;
        visited.add(claimed.id);

        try {
          await execute(clone(claimed));
          await store.transaction((tx) => {
            const current = tx.get(claimed.id);
            if (current?.status === "running" && current.owner === workerId) {
              tx.put({ ...current, status: "completed" });
            }
          });
        } catch {
          await store.transaction((tx) => {
            const current = tx.get(claimed.id);
            if (current?.status !== "running" || current.owner !== workerId) return;
            const status = current.attempts > 3 ? "failed" : "pending";
            tx.put({ ...current, status });
          });
        }
      }
    },
  };
}

module.exports = { createScheduler };
`;

export const brokenAgentReadme = `# Broken Agent — The Scheduler

> Un agente de código dice que terminó. Todos los tests públicos pasan. Tu
> trabajo es decidir si realmente lo enviarías a producción y repararlo.

Repara \`scheduler.js\` sin cambiar la interfaz exportada
\`createScheduler(dependencies)\`.

## Comandos

\`\`\`sh
npm test
andes challenge test --challenge broken-agent --source ./scheduler.js
andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json
\`\`\`

Los tests locales y públicos son ilimitados. Tienes **5 evaluaciones oficiales**
contra escenarios ocultos. Las herramientas de AI están permitidas, pero este es
un challenge de colaboración: el agente implementa y el participante toma las
decisiones de ingeniería.

Los challenges técnicos son obligatorios para competir por un cupo. Enviar la
postulación solo crea tu candidatura: no reserva una plaza. Los mejores
resultados de los rankings serán seleccionados para el evento.

## Protocolo humano–agente

No le pidas al agente que resuelva todo en silencio. Antes de modificar el
scheduler, el agente debe presentarte al menos tres trazas de falla concretas del
starter. Tú eliges cuál investigar primero y explicas qué resultado nunca debería
ocurrir. El agente convierte esa decisión en una prueba y luego implementa.

Cuando los tests estén verdes, el agente debe enseñarte el cambio, la evidencia y
los supuestos que todavía no verificó. La evaluación oficial requiere
\`review.json\` con tus propias palabras:

- \`focus\`: \`concurrency\`, \`persistence\`, \`lease_recovery\`,
  \`retry_idempotency\`, \`regression_safety\` o \`performance\`;
- \`sourceDigest\`: SHA-256 de \`scheduler.js\` para vincular el juicio al cambio
  exacto (el agente puede calcular este valor mecánico);
- \`failureScenario\`: una secuencia concreta de eventos y su resultado
  incorrecto;
- \`evidence\`: la prueba o inspección que revisaste y qué demostró;
- \`decision\`: \`ship\` o \`block\`;
- \`confidence\`: un entero de 0 a 100;
- \`remainingRisk\`: el riesgo que aceptas o que todavía bloquea el release.

Forma del archivo (reemplaza cada valor entre <...>):

\`\`\`json
{
  "sourceDigest": "<sha256 de scheduler.js>",
  "focus": "<área elegida>",
  "failureScenario": "<tu traza concreta>",
  "evidence": "<la evidencia que revisaste>",
  "decision": "<ship o block>",
  "confidence": 0,
  "remainingRisk": "<el riesgo que queda>"
}
\`\`\`

Cada respuesta de texto debe tener entre 20 y 1,000 caracteres. El agente puede
explicar, debatir y guardar tus respuestas, pero no puede elegir el foco, inventar
tu razonamiento ni tomar la decisión de release por ti. Si cambias
\`scheduler.js\`, vuelve a revisar la evidencia antes de reemplazar el review.

La primera ejecución de \`challenge evaluate\` crea un enlace corto de
aprobación y **no consume** una evaluación. Abre ese enlace en tu computadora,
revisa el review vinculado al SHA-256 exacto y confirma con Windows Hello,
Touch ID, PIN del equipo o una llave de seguridad. Google Workspace puede
bloquear las passkeys del teléfono: no uses el código QR. Después repite el
mismo comando para ejecutar la evaluación oficial. Cada evaluación requiere una
aprobación nueva; la sesión OAuth del CLI no puede aprobarla.

## Contrato normativo

\`createScheduler({ store, clock, execute, workerId })\` devuelve:

- \`schedule({ id, runAt, payload })\`
- \`cancel(id)\`
- \`list()\`
- \`runDue()\`

### Jobs y valores de retorno

- \`id\` cumple \`^[A-Za-z0-9_-]{1,64}$\`.
- \`runAt\` usa el perfil ISO-8601
  \`YYYY-MM-DDTHH:mm:ss[.SSS](Z|±HH:mm)\`: los segundos y la zona son
  obligatorios, y la fracción opcional admite entre uno y tres dígitos.
- \`payload\` es un valor JSON estricto: null, boolean, string, número finito,
  arreglo u objeto compuesto únicamente por otros valores JSON.
- Los timestamps pasados son válidos y quedan vencidos inmediatamente.
- \`schedule()\` persiste y devuelve el job. Programar el mismo ID, timestamp y
  payload JSON estructuralmente equivalente es idempotente. Reutilizar un ID
  para otro trabajo debe rechazar sin cambiar el job original.
- \`cancel()\` devuelve true solo cuando cambia un job pendiente a cancelado.
  Un job running, completed, failed o inexistente no puede cancelarse.
- \`list()\` devuelve todos los jobs ordenados cronológicamente por \`runAt\` y,
  ante empate, por \`id\`. Como mínimo expone \`id\`, \`runAt\`, \`payload\`,
  \`status\` y \`attempts\`.

### Estado, concurrencia y recuperación

- Los estados son \`pending\`, \`running\`, \`completed\`, \`failed\` y
  \`cancelled\`. Los jobs nuevos empiezan pending con cero intentos.
- El store sobrevive nuevas instancias del scheduler y reinicios del proceso.
- Varios workers, incluso instancias que reutilizan un \`workerId\` después de
  reiniciar, pueden llamar \`runDue()\` contra el mismo store.
- \`runDue()\` reclama un job antes de llamar al executor. Un job que falla
  queda pendiente para una llamada posterior y no bloquea otros jobs.
- Cada ejecución debe reclamarse atómicamente. El claim dura 30 segundos.
  Cuando \`clock.now()\` alcanza ese deadline, otro worker puede reclamar el
  job. Un worker que ya no es dueño del claim, incluido un proceso que vuelve
  con el mismo \`workerId\`, no puede completarlo, marcarlo como fallido ni
  reabrirlo.
- Un intento se cuenta al reclamar el job. Después de 3 ejecuciones fallidas el
  job queda failed.
- \`execute(job)\` puede fallar antes o después de aplicar el efecto. El adapter
  aplica efectos idempotentemente por job ID, por lo que reintentar debe llevar
  el job a completed sin duplicar el efecto. No se promete exactly-once para
  efectos arbitrarios.
- \`runDue()\` resuelve cuando ya procesó todos los jobs que podía reclamar en
  esa llamada. No mantiene una transacción abierta mientras ejecuta un job.

El store expone solo \`transaction(action)\`. Dentro de una acción, \`tx\`
ofrece operaciones síncronas \`get(id)\`, \`put(job)\`, \`delete(id)\` y
\`list()\`. Las transacciones están serializadas. \`clock.now()\` devuelve un
\`Date\`; \`execute(job)\` devuelve una promesa.

## Evaluación

El evaluador usa variantes determinísticas por participante. El veredicto
oficial es un solo puntaje sobre 100. No incluye casos ocultos, un desglose por
capacidad ni un costo de ejecución.

El ranking exige una postulación enviada o revisada. Ordena por puntaje total,
luego por menos evaluaciones oficiales y, al final, por la hora del mejor
envío. Todos los puntajes válidos aparecen en el ranking.
`;

export const brokenAgentPublicTestSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const { createScheduler } = require("./scheduler.js");

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

class MemoryStore {
  constructor() {
    this.jobs = new Map();
    this.tail = Promise.resolve();
  }

  transaction(action) {
    const run = this.tail.then(() => action({
      get: (id) => clone(this.jobs.get(id)),
      put: (job) => {
        this.jobs.set(job.id, clone(job));
        return clone(job);
      },
      delete: (id) => this.jobs.delete(id),
      list: () => [...this.jobs.values()].map(clone),
    }));
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}

const setup = (options = {}) => {
  const store = options.store || new MemoryStore();
  const now = options.now || new Date("2026-10-17T15:00:00.000Z");
  const executed = [];
  const execute = options.execute || (async (job) => executed.push(job.id));
  const scheduler = createScheduler({
    store,
    clock: { now: () => new Date(now) },
    execute,
    workerId: options.workerId || "public-worker",
  });
  return { store, scheduler, executed };
};

const job = (id, runAt = "2026-10-17T15:00:00.000Z", payload = { message: id }) => ({
  id,
  runAt,
  payload,
});

test("programa un job y conserva el estado público", async () => {
  const { scheduler } = setup();
  const scheduled = await scheduler.schedule(job("job-1"));
  assert.equal(scheduled.status, "pending");
  assert.equal(scheduled.attempts, 0);
  assert.equal((await scheduler.list()).length, 1);
});

test("ejecuta vencidos y deja futuros pendientes", async () => {
  const { scheduler, executed } = setup();
  await scheduler.schedule(job("due"));
  await scheduler.schedule(job("future", "2026-10-17T16:00:00.000Z"));
  await scheduler.runDue();
  assert.deepEqual(executed, ["due"]);
  const jobs = await scheduler.list();
  assert.equal(jobs.find((entry) => entry.id === "due").status, "completed");
  assert.equal(jobs.find((entry) => entry.id === "future").status, "pending");
});

test("cancela únicamente jobs pendientes", async () => {
  const { scheduler, executed } = setup();
  await scheduler.schedule(job("cancel-me"));
  assert.equal(await scheduler.cancel("cancel-me"), true);
  assert.equal(await scheduler.cancel("cancel-me"), false);
  await scheduler.runDue();
  assert.deepEqual(executed, []);
});

test("programar el mismo trabajo es idempotente y los conflictos rechazan", async () => {
  const { scheduler } = setup();
  await scheduler.schedule(job("same", undefined, { a: 1, b: 2 }));
  await scheduler.schedule(job("same", undefined, { b: 2, a: 1 }));
  await assert.rejects(() => scheduler.schedule(job("same", undefined, { a: 2 })));
  assert.equal((await scheduler.list()).length, 1);
});

test("valida IDs, timestamps con zona y payloads JSON", async () => {
  const { scheduler } = setup();
  await assert.rejects(() => scheduler.schedule(job("contains spaces")));
  await assert.rejects(() => scheduler.schedule(job("bad-time", "tomorrow-ish")));
  await assert.rejects(() => scheduler.schedule(job("missing-zone", "2026-10-17T15:00:00")));
  await assert.rejects(() => scheduler.schedule(job("missing-seconds", "2026-10-17T15:00Z")));
  await assert.rejects(() => scheduler.schedule(job("long-fraction", "2026-10-17T15:00:00.1234Z")));
  await assert.rejects(() => scheduler.schedule(job("bad-payload", undefined, { value: undefined })));
});

test("ordena cronológicamente y usa el ID para desempatar", async () => {
  const { scheduler } = setup();
  await scheduler.schedule(job("later", "2026-10-17T16:30:00.000Z"));
  await scheduler.schedule(job("first", "2026-10-17T10:00:00-05:00"));
  await scheduler.schedule(job("also-first", "2026-10-17T15:00:00.000Z"));
  assert.deepEqual((await scheduler.list()).map((entry) => entry.id), ["also-first", "first", "later"]);
});

test("una falla no bloquea otros jobs y reintenta en la llamada siguiente", async () => {
  let failures = 1;
  const executed = [];
  const { scheduler } = setup({
    execute: async (entry) => {
      if (entry.id === "flaky" && failures > 0) {
        failures -= 1;
        throw new Error("transient");
      }
      executed.push(entry.id);
    },
  });
  await scheduler.schedule(job("flaky"));
  await scheduler.schedule(job("healthy"));
  await scheduler.runDue();
  assert.deepEqual(executed, ["healthy"]);
  await scheduler.runDue();
  assert.deepEqual(executed, ["healthy", "flaky"]);
});
`;
