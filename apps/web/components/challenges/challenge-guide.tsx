import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";
import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Instala la CLI",
    command: "curl -fsSL https://hacktheandes.com/install | bash",
    body: "No necesitas Node.js ni npm. Al terminar, abre otra terminal o ejecuta el export PATH que muestra el instalador.",
  },
  {
    title: "Inicia sesión y prepara tu archivo",
    command: "andes login && andes challenge init",
    body: "La CLI crea shipping.js sin sobrescribir archivos existentes.",
  },
  {
    title: "Interroga la máquina",
    command:
      "andes challenge query --distance 10 --weight 3 --hour 14 --fragile false --express false",
    body: "Cambia una variable a la vez. Cada respuesta exitosa consume una de tus 25 queries.",
  },
  {
    title: "Estudia tus observaciones",
    command: "andes challenge notebook",
    body: "Busca umbrales, recargos fijos e interacciones entre los cinco inputs.",
  },
  {
    title: "Implementa y prueba gratis",
    command: "andes challenge test --source ./shipping.js",
    body: "Exporta calculateShipping(input) desde shipping.js. Los tests contra tu notebook no consumen evaluaciones.",
  },
  {
    title: "Envía una evaluación oficial",
    command: "andes challenge evaluate --source ./shipping.js",
    body: "La evaluación usa envíos ocultos y consume uno de tus 3 intentos oficiales. Hazlo cuando tu modelo esté listo.",
  },
] as const;

export function BlackBoxChallengeGuide() {
  return (
    <div className="mt-14 space-y-14">
      <section aria-labelledby="challenge-brief-heading">
        <BrandKicker className="mb-3 text-[var(--hud-status)]">
          Challenge de clasificación / no es un track
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="challenge-brief-heading"
        >
          El reto
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
          Una empresa de delivery retirará el servicio que calcula el precio de
          cada envío. No hay documentación ni código fuente: solo cinco inputs y
          el precio que devuelve la máquina. Descubre las reglas ocultas y
          reemplázala con tu propia función{" "}
          <code>calculateShipping(input)</code>.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Este challenge ocurre antes de la hackathon. Las reglas están
          personalizadas para cada participante y puedes usar AI. Los challenges
          técnicos son obligatorios para competir por un cupo: enviar la
          postulación no reserva una plaza y los mejores resultados de los
          rankings serán seleccionados para el evento. La CLI y la API siempre
          usan la versión vigente; los intentos legacy no cuentan.
        </p>

        <dl className="mt-8 grid gap-px bg-[var(--hud-ink)]/10 sm:grid-cols-3">
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Oracle
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">25 queries</dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Hidden set
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              1,000 envíos
            </dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Intentos
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              3 evaluaciones oficiales
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="challenge-instructions-heading">
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          Field guide
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="challenge-instructions-heading"
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
