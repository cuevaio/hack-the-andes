import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";

import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Crea el repositorio",
    command: "chofex challenge init --challenge broken-agent",
    body: "La CLI crea broken-agent/ con el contrato normativo, una implementación plausible pero defectuosa y siete tests públicos.",
  },
  {
    title: "Confirma el punto de partida",
    command: "cd broken-agent && npm test",
    body: "Everything passes. Ese es el problema: los happy paths no demuestran que el scheduler sea seguro en producción.",
  },
  {
    title: "Elige una falla con el participante",
    command: "Discute tres trazas adversas antes de editar",
    body: "El agente explica riesgos concretos. El participante elige cuál probar primero y define qué resultado sería inaceptable; el agente no responde por él.",
  },
  {
    title: "Audita y repara",
    command: "$EDITOR scheduler.js",
    body: "Primero convierte la traza elegida en una prueba. Después mantén createScheduler y endurece claims únicos, concurrencia, persistencia, leases de 30 segundos, reintentos, cancelación e idempotencia.",
  },
  {
    title: "Protege el comportamiento visible",
    command:
      "chofex challenge test --challenge broken-agent --source ./scheduler.js",
    body: "Los tests públicos son ilimitados. No uses una evaluación oficial mientras tengas regresiones visibles.",
  },
  {
    title: "Toma la decisión de release",
    command: "Crea review.json con las palabras del participante",
    body: "El participante describe la falla, qué evidencia revisó, ship o block, su confianza y el riesgo restante. El review incluye el SHA-256 de scheduler.js, así que un cambio exige revisar de nuevo.",
  },
  {
    title: "Crea el handoff de evaluación",
    command:
      "chofex challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
    body: "La primera llamada devuelve un enlace corto y todavía no consume una evaluación.",
  },
  {
    title: "Aprueba personalmente",
    command: "Abre approvalUrl en tu computadora",
    body: "Revisa tu razonamiento vinculado al source exacto y confirma con Face ID, Touch ID, Windows Hello, PIN o llave de seguridad. Google Workspace puede bloquear las passkeys del teléfono. El agente no puede completar este paso.",
  },
  {
    title: "Solicita el veredicto oculto",
    command:
      "chofex challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
    body: "Repite el comando antes de que venza la aprobación. Esta vez consume 1 de 5 evaluaciones oficiales y devuelve un solo puntaje.",
  },
] as const;

export function BrokenAgentChallengeGuide() {
  return (
    <div className="mt-14 space-y-14">
      <section aria-labelledby="broken-agent-brief-heading">
        <BrandKicker className="mb-3 text-[var(--hud-status)]">
          Challenge de clasificación / AI permitida
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="broken-agent-brief-heading"
        >
          El agente dijo que terminó
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
          Recibes un job scheduler generado por un agente de código. La API está
          implementada y todos los tests públicos pasan. Tu trabajo es convertir
          una solución plausible en software que realmente enviarías a
          producción.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Este no es un benchmark para dejar al agente trabajando solo. El
          agente puede auditar, programar y ejecutar pruebas; tú eliges qué
          riesgo investigar, cuestionas su evidencia y decides si harías ship.
          La evaluación oficial no acepta solo código: incluye tu review
          vinculado a esa versión exacta del archivo.
        </p>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-[var(--hud-ink)]">
          Los challenges son obligatorios para competir por un cupo. La
          postulación no reserva una plaza; los mejores resultados de los
          rankings serán seleccionados para el evento. El slug del challenge
          siempre usa la versión vigente; los intentos legacy quedan solo como
          historial.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          El contrato es público; cada participante recibe variantes
          determinísticas de los escenarios adversos. El executor aplica efectos
          idempotentemente por job ID, así que el sistema puede recuperarse sin
          prometer exactly-once para efectos arbitrarios. Puedes usar Claude
          Code, Codex, Cursor o cualquier otra AI.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          El veredicto oficial es un solo puntaje sobre 100. Los empates se
          resuelven por menos evaluaciones oficiales y, al final, por la hora
          del mejor envío. El ranking se revela el 1 de octubre a las 15:00 y el
          challenge cierra el 2 de octubre a las 00:00, hora de Perú. Todos los
          puntajes válidos con una postulación enviada aparecen en el ranking.
        </p>

        <dl className="mt-8 grid gap-px bg-[var(--hud-ink)]/10 sm:grid-cols-3">
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Inicio
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              7/7 tests verdes
            </dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Hidden score
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">100 puntos</dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Intentos
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              5 evaluaciones oficiales
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="broken-agent-instructions-heading">
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          Field guide
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="broken-agent-instructions-heading"
        >
          Cómo participar
        </h2>
        <ol className="mt-8 grid gap-4">
          {workflow.map((item, index) => (
            <li
              className={`grid gap-5 p-5 sm:grid-cols-[3rem_minmax(0,1fr)] sm:p-6 ${brandFrameClassName}`}
              key={item.title}
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
