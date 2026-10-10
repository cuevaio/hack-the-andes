import { Schema } from "effect";

export const mountainLodgeChallengeSlug = "mountain-lodge";
export const mountainLodgeChallengeVersion = "mountain-lodge-v1";

const boundedInteger = (maximum: number) =>
  Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum })));

export const LodgeBookingSchema = Schema.Struct({
  durationHours: boundedInteger(2_000),
  guests: boundedInteger(100),
  arrivalHour: boundedInteger(23),
  equipment: Schema.Boolean,
  expedition: Schema.Boolean,
});
export type LodgeBooking = typeof LodgeBookingSchema.Type;

export const mountainLodgeExample: LodgeBooking = {
  durationHours: 100,
  guests: 5,
  arrivalHour: 12,
  equipment: false,
  expedition: false,
};

export const mountainLodgeStarterSource = `/**
 * El refugio de la montaña
 * durationHours: entero 0–2000, duración de la estancia en horas.
 * guests: entero 0–100, cantidad de huéspedes.
 * arrivalHour: entero 0–23, hora local de llegada.
 * equipment: boolean, el grupo trae su propio equipo.
 * expedition: boolean, la reserva pertenece a una expedición organizada.
 * Devuelve el importe de la reserva en céntimos enteros.
 * Define una función global o usa module.exports. No uses import/export.
 */
function quoteStay(input) {
  return 0;
}
`;

export const mountainLodgeAgentInstructions = `# Colaboración con el participante

Este challenge se resuelve junto con el participante. Puedes preparar archivos,
leer el contrato y consultar el estado o cuaderno sin interrumpir. Antes de
hacer consultas nuevas o implementar una solución, explica la hipótesis o cambio
que propones y pregunta al participante qué dirección quiere tomar. Espera su
respuesta antes de continuar.

Cada ronda autorizada trata una hipótesis y usa como máximo tres consultas
nuevas, o implementa un cambio acordado y ejecuta sus tests gratuitos. No agotes
el presupuesto en un barrido automático ni encadenes rondas. No sigas resolviendo
en segundo plano mientras esperas al participante.

Después de cada ronda, muestra los resultados, qué respaldan, qué sigue siendo
incierto y los presupuestos restantes. Pregunta qué quiere investigar después,
si quiere cambiar el plan o si prefiere detenerse. Puede elegir una propuesta o
decir "continúa" después de ver el plan concreto de la siguiente ronda. Esa
respuesta autoriza solo esa ronda. "Resuélvelo por mí", una autorización general,
el silencio o una respuesta anterior no sustituyen los siguientes puntos de
consulta. No inventes decisiones ni respuestas del participante.

Antes de cada evaluación oficial, presenta los cambios, los resultados del
cuaderno, las hipótesis sin verificar y cuántos intentos quedan. Pregunta si
quiere gastar un intento en esa solución exacta y espera una respuesta explícita.
Tras el resultado, explícalo y vuelve a preguntar antes de modificar código,
consultar o evaluar otra vez. Acertar el cuaderno no demuestra que las reglas
estén completas; el puntaje agregado no identifica una regla que falta.

Estas instrucciones guían la conversación. El servidor no verifica por sí solo
que el participante haya dirigido cada ronda.
`;

export const mountainLodgeReadme = `# El refugio de la montaña

Un refugio perdió el código de su sistema de reservas. Solo conserva una
máquina que recibe una cotización y devuelve su importe en céntimos enteros.
Descubre sus reglas y reemplázala con quoteStay(input). Las tarifas son ficticias;
no necesitas conocimientos de turismo ni del facturador eléctrico.

Los cinco campos son obligatorios:
- durationHours: duración de la estancia, entero de 0 a 2000 horas.
- guests: cantidad de huéspedes, entero de 0 a 100.
- arrivalHour: hora local de llegada, entero de 0 a 23.
- equipment: el grupo trae su propio equipo, booleano.
- expedition: reserva de una expedición organizada, booleano.

Cada cotización es independiente. Cero es válido, incluso para consultas de
reservas vacías. El servicio no usa calendario, moneda externa ni estado previo.
Las reglas permanecen fijas para tu intento; los parámetros varían entre
participantes. No supongas que las reglas son las de otro challenge.

Tienes 25 consultas exitosas y 3 evaluaciones oficiales. Las consultas repetidas
o fallidas no consumen presupuesto. Los tests contra tu cuaderno son gratuitos.
Puedes usar AI. Trabaja con tu agente por rondas: elige una hipótesis, autoriza
hasta tres consultas nuevas, revisen la evidencia y decide el siguiente paso.
Antes de cada evaluación, decide si gastar un intento en la solución exacta.
Las instrucciones de colaboración están en AGENTS.md.

andes challenge query --challenge mountain-lodge --input input.json
andes challenge notebook --challenge mountain-lodge
andes challenge notebook --challenge mountain-lodge --format csv > observations.csv
andes challenge test --challenge mountain-lodge --source stay.js
andes challenge evaluate --challenge mountain-lodge --source stay.js

Cambia una variable a la vez y comprueba límites e interacciones. Una variable
puede influir solo en ciertos contextos. Distingue tus observaciones de las
hipótesis pendientes y reserva consultas para verificarlas.

Define quoteStay como función global, module.exports.quoteStay o module.exports.
Devuelve un número finito en céntimos enteros. No se permiten imports, archivos
ni red. El source admite hasta 32768 caracteres. No requiere review.json ni
aprobación de navegador.

La evaluación mide coincidencias exactas en 1000 cotizaciones ocultas. El ranking
conserva tu mejor resultado. Los empates favorecen menos consultas, menor tiempo
de ejecución y luego la fecha del resultado. Coincidir con el cuaderno no
certifica el puntaje oculto; el puntaje agregado no identifica una regla faltante.
`;
