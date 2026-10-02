import {
  slowServiceChallengeVersion,
  slowServicePublicPerformance,
} from "@chofex/challenges-contract/slow-service";
import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";
import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Revisa si el challenge está disponible",
    command: "andes challenge list",
    body: "slow-service-v3 está disponible para trabajar en compañía de tu agente. No uses fuentes ni kits de versiones anteriores.",
  },
  {
    title: "Prepara el diario",
    command: "chofex challenge init --challenge make-it-fast",
    body: "El toolkit aprobado creará slow-service/ con ledger.js, el contrato, tests y benchmark públicos. No sobrescribe una carpeta existente.",
  },
  {
    title: "Lee el contrato y prueba localmente",
    command: "cd slow-service && bun install && bun test ./.kit/ledger.test.ts",
    body: "Necesitas Bun 1.3.14 y Node 24 o posterior en Linux o macOS. Conserva .kit, package.json y bun.lock; optimiza ledger.js y agrega tus propios tests. El factory recibe las cuentas por separado; después recibe una operación a la vez.",
  },
  {
    title: "Comprueba tus respuestas en QuickJS",
    command:
      "andes challenge test --challenge make-it-fast --source ./ledger.js",
    body: "Los tests públicos son ilimitados y no consumen evaluaciones. Comprueban ejemplos de semántica, no certifican rendimiento oculto.",
  },
  {
    title: "Mide CPU y memoria retenida",
    command: "bun run benchmark ledger.js 1000",
    body: "Empieza con una carga reducida. El tamaño base acepta enteros de 1 a 6,000; por defecto usa 6,000. Verifica cada respuesta con un scanner independiente y muestra CPU total, CPU de fase y pico de RSS. No calcula un puntaje oficial.",
  },
  {
    title: "Comprueba el tamaño completo",
    command: "bun run benchmark ledger.js 6000",
    body: "Compara 6,000 y 24,000 journals con 1,024 operaciones posteriores. Usa montos variados, no una grilla pequeña. El starter puede alcanzar los límites de ejecución.",
  },
  {
    title: "Comprueba la historia máxima",
    command: "bun run benchmark ledger.js 6000 --max-history",
    body: "--max-history requiere el tamaño base 6000. Agrega correcciones hasta alcanzar 72,000 ediciones de legs aceptadas. Pasar tests pequeños no demuestra que el historial completo quepa en memoria.",
  },
  {
    title: "Comprueba la mayor historia de débitos",
    command: "bun run benchmark ledger.js 6000 --max-history --negative-heavy",
    body: "--negative-heavy requiere --max-history y el tamaño base 6000. Usa 2,000 y 8,000 journals con ocho legs, siete negativas y una positiva. Alcanza 72,000 ediciones de legs y 63,000 ediciones de débitos aceptadas. Son diagnósticos locales de memoria, no los tamaños oficiales de eficiencia de 6,000 y 24,000.",
  },
  {
    title: "Envía una evaluación oficial",
    command:
      "andes challenge evaluate --challenge make-it-fast --source ./ledger.js --review ./review.json",
    body: "Tienes 5 evaluaciones oficiales. Elige con tu agente un caso de falla, revisa sus inputs y resultados reales y registra el riesgo restante en review.json. Vincúlalo al SHA-256 de ledger.js. Abre personalmente approvalUrl, revisa el código exacto y aprueba con tu passkey. Repite el comando antes de que venza. block detiene el envío; la espera y los errores del servidor no consumen intentos. Un rechazo de inicialización no consume un intento. El README incluye el formato completo.",
  },
  {
    title: "Consulta tu resultado",
    command: "andes challenge ranking --challenge make-it-fast",
    body: "El ranking requiere una postulación enviada. Ordena por puntaje, menos evaluaciones oficiales y la hora del mejor envío. No reserva un cupo ni usa CPU como desempate.",
  },
];

const contract = [
  [
    "Cuentas configuradas",
    "createLedger({ accounts: [{ id, opening }] }) crea un diario vacío en checkpoint 0. opening es un entero no negativo anterior a todas las entradas. No se crean ni eliminan cuentas después. El orden del setup define el orden de diagnóstico.",
  ],
  [
    "Revisiones optimistas",
    "amend({ id, expectedRevision, entry }) compara expectedRevision con la revisión actual antes de hacer trabajo. Un ID desconocido tiene revisión 0. Si no coinciden, devuelve conflict con la revisión actual y no cambia nada.",
  ],
  [
    "Reemplazo atómico",
    "entry contiene at y 2 a 8 legs, cada una para una cuenta distinta y configurada. Las deltas son enteros no nulos y suman cero. Una delta positiva aumenta el saldo y una negativa lo reduce. Retira la entrada anterior y añade la nueva por completo antes de comprobar solvencia.",
  ],
  [
    "Solvencia en todo el tiempo",
    "Agrupa todas las deltas del mismo timestamp antes de calcular el saldo. Ninguna cuenta afectada puede quedar negativa en ningún momento efectivo, aunque termine con saldo positivo. Cero sí es válido.",
  ],
  [
    "Diagnóstico y rollback",
    "Si falla la solvencia, devuelve insolvent con la primera cuenta insolvente en orden de setup y su primer timestamp negativo y saldo allí. Un conflicto o insolvencia no cambia entradas, revisiones, tombstones, checkpoint, saldos ni distribución histórica de débitos.",
  ],
  [
    "Commit y anulaciones",
    "Un éxito devuelve committed e incrementa en uno la revisión del ID y el checkpoint global. entry: null conserva la revisión como tombstone. Anular un ID ausente o ya anulado, o reemplazarlo por una entrada idéntica, también es un éxito si la revisión coincide.",
  ],
  [
    "Reportes históricos",
    "report({ account, from, to, asOf, percentile }) usa la historia aceptada en asOf, entre 0 y el checkpoint actual. from y to son tiempo efectivo; asOf es un checkpoint. percentile es un entero de 1 a 100. Las modificaciones futuras nunca cambian un reporte del mismo asOf.",
  ],
  [
    "Saldos y conteo exactos",
    "opening incluye el saldo inicial y deltas anteriores a from. net suma [from, to), closing es opening + net, entries cuenta entradas del intervalo con una leg para esa cuenta, y minimumBalance incluye opening y los saldos después de cada grupo de timestamp.",
  ],
  [
    "Percentil exacto de débitos",
    "debits cuenta las legs negativas de esa cuenta en [from, to) y asOf. debitAmountAtPercentile selecciona el importe positivo en la posición ceil(debits * percentile / 100) de las magnitudes ordenadas, con multiplicidad. No promedia ni interpola: el percentil 50 de [100, 300] es 100, no 200; el percentil 100 es 300.",
  ],
  [
    "Créditos y timestamps iguales",
    "Los créditos no entran en la distribución. Dos débitos del mismo importe o timestamp cuentan por separado, aunque las deltas del grupo se compensen para el saldo. Sin débitos, debits es 0 y debitAmountAtPercentile es null. El reporte devuelve exactamente siete campos.",
  ],
  [
    "Grupos e intervalos vacíos",
    "Dos entradas cuentan como dos aunque sus deltas se cancelen en el mismo timestamp. Si from === to, net, entries y debits son cero; closing y minimumBalance son opening y debitAmountAtPercentile es null. No uses un orden de IDs o legs dentro de un timestamp para la solvencia.",
  ],
  [
    "Llamadas online",
    "El factory devuelve exactamente los métodos amend y report. El factory y ambos métodos son síncronos. Cada instancia es independiente. No modifiques inputs ni devuelvas promesas. El guest recibe solo la operación actual, nunca operaciones futuras, aunque pueda consultar checkpoints anteriores.",
  ],
];

const limits = [
  [
    "Cuentas",
    "De 2 a 1,024, con IDs distintos; solo las configuradas en el setup",
  ],
  [
    "IDs de cuenta y entrada",
    "Strings opacos de 1 a 64 unidades UTF-16; igualdad exacta, sin normalización",
  ],
  ["opening", "Entero entre 0 y 1,000,000,000,000"],
  [
    "delta",
    "Entero no nulo entre -1,000,000,000 y 1,000,000,000; suma de legs igual a cero",
  ],
  ["at", "Entero entre 0 y 2,147,483,647"],
  ["from y to", "0 ≤ from ≤ to ≤ 2,147,483,648"],
  [
    "percentile",
    "Entero entre 1 y 100; posición ceil(debits * percentile / 100), sin interpolación",
  ],
  [
    "debits",
    "Entero entre 0 y entries; cuenta las legs negativas con multiplicidad",
  ],
  [
    "debitAmountAtPercentile",
    "null si debits es 0; en otro caso entero entre 1 y 1,000,000,000",
  ],
  ["Operaciones", "Hasta 100,000 por instancia"],
  ["Entradas activas", "Hasta 24,000 a la vez"],
  [
    "Ediciones de legs aceptadas",
    "Hasta 72,000, contando las legs antiguas retiradas y las nuevas añadidas",
  ],
  [
    "Fuente",
    "Hasta 32,768 bytes UTF-8; createLedger nombrado o module.exports = { createLedger }",
  ],
  [
    "Sandbox",
    "quickjs-emscripten@0.32.0; heap del guest de 640 MiB y stack de 512 KiB",
  ],
  [
    "Seguridad por carga",
    "30 segundos de reloj, 25 segundos de CPU y hasta 32 MiB de salida",
  ],
];

export function SlowServiceChallengeGuide() {
  return (
    <div className="mt-14 space-y-14">
      <section aria-labelledby="slow-service-brief">
        <BrandKicker className="mb-3 text-[var(--hud-status)]">
          Humano + agente · {slowServiceChallengeVersion}
        </BrandKicker>
        <h2
          id="slow-service-brief"
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
        >
          Débitos históricos con percentiles exactos
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
          Un diario contable recibe movimientos entre cuentas y correcciones
          retroactivas. Debe rechazar cambios que produzcan un saldo negativo en
          cualquier momento, publicar cada corrección de forma atómica y
          reproducir saldos y percentiles exactos de débitos en checkpoints
          anteriores.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Tu trabajo es mantener cada respuesta exacta sin recorrer todas las
          entradas ni copiar toda la historia en cada cambio. Tu agente puede
          implementar y probar. Tú eliges un caso concreto, revisas la evidencia
          y autorizas el código exacto antes de evaluar. Puedes usar AI en ambas
          etapas. La aprobación registra responsabilidad, no demuestra
          comprensión ni autoría independiente. Una solución correcta y
          eficiente puede obtener 100 puntos.
        </p>
      </section>
      <section aria-labelledby="slow-service-contract">
        <h2
          id="slow-service-contract"
          className="font-display text-4xl uppercase"
        >
          El contrato
        </h2>
        <pre className="brand-code mt-6 overflow-x-auto border p-5 text-sm">{`const ledger = createLedger({ accounts: [
  { id: "caja", opening: 1000 },
  { id: "tienda", opening: 0 },
  { id: "impuesto", opening: 0 },
] });
ledger.amend({ id: "venta", expectedRevision: 0, entry: {
  at: 10, legs: [
    { account: "caja", delta: -300 },
    { account: "tienda", delta: 300 },
  ],
} }); // { kind: "committed", revision: 1, checkpoint: 1 }
ledger.report({ account: "tienda", from: 10, to: 11, asOf: 1, percentile: 50 });
// { opening: 0, net: 300, closing: 300, entries: 1,
//   minimumBalance: 0, debits: 0, debitAmountAtPercentile: null }
ledger.report({ account: "caja", from: 10, to: 11, asOf: 1, percentile: 100 });
// { opening: 1000, net: -300, closing: 700, entries: 1,
//   minimumBalance: 700, debits: 1, debitAmountAtPercentile: 300 }`}</pre>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {contract.map(([title, body]) => (
            <div key={title} className={`p-5 ${brandFrameClassName}`}>
              <dt className="font-semibold">{title}</dt>
              <dd className="mt-3 text-sm leading-relaxed text-[var(--hud-muted)]">
                {body}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-[var(--hud-muted)]">
          Todos los inputs cumplen el contrato y todos los resultados caben en
          enteros seguros de JavaScript. Una insolvencia devuelve exactamente{" "}
          {"{ kind: 'insolvent', account, at, balance }"}. Un conflicto devuelve{" "}
          {"{ kind: 'conflict', revision }"}. Los importes son centavos enteros,
          sin tolerancias ni redondeo.
        </p>
      </section>
      <section
        aria-labelledby="slow-service-limits"
        className={`p-6 ${brandFrameClassName}`}
      >
        <h2
          id="slow-service-limits"
          className="font-display text-3xl uppercase"
        >
          Límites de v3
        </h2>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {limits.map(([title, body]) => (
            <div key={title}>
              <dt className="font-semibold">{title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--hud-muted)]">
                {body}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        aria-labelledby="slow-service-memory"
        className={`p-6 ${brandFrameClassName}`}
      >
        <h2
          id="slow-service-memory"
          className="font-display text-3xl uppercase"
        >
          La historia cuesta memoria
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Una corrección aceptada debe conservar las vistas anteriores. Tener
          pocas entradas activas no elimina el costo de esos checkpoints. Un
          intento rechazado no debe acumular historia. El límite de 72,000
          ediciones aceptadas permite presupuestar la memoria retenida. Las
          representaciones compactas son una opción, no un requisito secreto.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          El benchmark aprobado debe mostrar el pico de RSS a partir de
          peakRssBytes, medido por el proceso hijo. Incluye Node, WASM y trabajo
          confiable del runner. No equivale al heap del guest ni es un puntaje.
          Un resultado memory, budget o timeout no es una medición válida de
          velocidad.
        </p>
      </section>
      <section
        aria-labelledby="slow-service-performance"
        className={`p-6 ${brandFrameClassName}`}
      >
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          Rendimiento reproducible
        </BrandKicker>
        <h2
          id="slow-service-performance"
          className="font-display text-3xl uppercase"
        >
          Correctitud antes de eficiencia
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Seis grupos exactos de correctitud valen 10 puntos cada uno. Debes
          aprobar los seis para desbloquear los 40 puntos de eficiencia. Cada
          una de cuatro familias entrega 10, 6, 3 o 0 puntos. Una respuesta
          incorrecta o fallo de ejecución en cualquier carga de rendimiento
          anula toda la eficiencia, incluso la de otras familias. Si aprobaste
          los seis grupos de correctitud, conservas esos 60 puntos.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Para habilitar la eficiencia también debes completar reportes exactos
          con el historial máximo: 24,000 journals o entradas de ocho legs que
          acumulan 63,000 ediciones de débitos. Ambos casos alcanzan 72,000
          ediciones de legs y pueden configurar 1,024 cuentas con IDs de 64
          unidades UTF-16. No agregan grupos de correctitud ni puntos:
          comprueban capacidad bajo los mismos límites de 640 MiB, 25 segundos
          de CPU y 30 segundos de reloj para toda la ejecución. Si fallas por
          resultados, tiempo o memoria, conservas los puntos de correctitud y no
          puedes habilitar los 40 de eficiencia. Usa los benchmarks
          --max-history y --negative-heavy para comprobar esos límites
          localmente.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          La fase medida compara N y 4N, con{" "}
          {slowServicePublicPerformance.smallJournalCount.toLocaleString(
            "en-US",
          )}{" "}
          y{" "}
          {slowServicePublicPerformance.largeJournalCount.toLocaleString(
            "en-US",
          )}{" "}
          journals y{" "}
          {slowServicePublicPerformance.phaseOperations.toLocaleString("en-US")}{" "}
          operaciones después de la carga inicial. La carga inicial queda fuera
          de esa fase, pero debe respetar los límites de tiempo y memoria. Los
          tamaños y los niveles siguientes están calibrados. Las cuatro familias
          cubren distribuciones de pagos, correcciones de
          monto/fecha/cuenta/signo, distribuciones históricas y concentraciones
          de timestamps o montos repetidos. Los benchmarks locales no certifican
          un resultado en esas pruebas oficiales.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          El crecimiento normalizado es (CPU_grande / CPU_pequeña) de tu
          solución dividido por ese mismo crecimiento de la referencia. El costo
          relativo es CPU_grande de tu fase dividida por CPU_grande de la
          referencia. Debes cumplir ambos límites del nivel.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left text-[var(--hud-muted)]">
              Niveles calibrados de {slowServiceChallengeVersion}
            </caption>
            <thead>
              <tr>
                <th className="p-3">Puntos por familia</th>
                <th className="p-3">Crecimiento normalizado máximo</th>
                <th className="p-3">Costo relativo máximo</th>
              </tr>
            </thead>
            <tbody>
              {slowServicePublicPerformance.tiers.map((tier) => (
                <tr key={tier.points}>
                  <td className="p-3">{tier.points}</td>
                  <td className="p-3">{tier.normalizedGrowth}</td>
                  <td className="p-3">{tier.relativeCpu}</td>
                </tr>
              ))}
              <tr>
                <td className="p-3">0</td>
                <td className="p-3" colSpan={2}>
                  Fuera de los límites anteriores
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          La referencia usa medianas de tres ejecuciones; las mediciones
          cercanas a los umbrales se repiten. Los resultados locales muestran
          crecimiento bruto, no normalizado, y no certifican el puntaje oficial.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Los checkpoints del interrupt de QuickJS solo limitan la ejecución por
          seguridad. No puntúan eficiencia. No hay red, archivos, timers,
          require, imports, paquetes externos ni compilación dinámica en el
          guest. Los tests públicos no revelan casos ocultos y no se publicará
          tu implementación.
        </p>
      </section>
      <section aria-labelledby="slow-service-workflow">
        <h2
          id="slow-service-workflow"
          className="font-display text-4xl uppercase"
        >
          Cómo participar
        </h2>
        <ol className="mt-8 grid gap-4">
          {workflow.map((item, index) => (
            <li
              key={item.title}
              className={`grid gap-5 p-5 sm:grid-cols-[3rem_minmax(0,1fr)] ${brandFrameClassName}`}
            >
              <span className="font-mono text-[var(--hud-action)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{item.title}</h3>
                <pre className="brand-code mt-3 overflow-x-auto border p-4 text-sm">
                  <ShellCommand command={item.command} />
                </pre>
                <p className="mt-3 text-sm leading-relaxed text-[var(--hud-muted)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
