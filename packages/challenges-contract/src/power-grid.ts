import { Schema } from "effect";

export const powerGridChallengeSlug = "power-grid";
export const powerGridChallengeVersion = "power-grid-v1";

const boundedInteger = (maximum: number) =>
  Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum })));

export const PowerReadingSchema = Schema.Struct({
  consumptionKwh: boundedInteger(2_000),
  demandKw: boundedInteger(100),
  hour: boundedInteger(23),
  solar: Schema.Boolean,
  business: Schema.Boolean,
});
export type PowerReading = typeof PowerReadingSchema.Type;

export const powerGridExample: PowerReading = {
  consumptionKwh: 100,
  demandKw: 5,
  hour: 12,
  solar: false,
  business: false,
};

export const powerGridStarterSource = `/**
 * La máquina de facturación eléctrica
 * consumptionKwh: entero 0–2000, energía importada en un periodo de medición.
 * demandKw: entero 0–100, demanda máxima registrada en ese periodo.
 * hour: entero 0–23, hora local de cierre del periodo.
 * solar: boolean, el suministro tiene generación solar.
 * business: boolean, el contrato es comercial.
 * Devuelve el importe del periodo en céntimos enteros.
 * Define una función global o usa module.exports. No uses import/export.
 */
function calculateBill(input) {
  return 0;
}
`;

export const powerGridAgentInstructions = `# Colaboración con el participante

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

export const powerGridReadme = `# La máquina de facturación eléctrica

Una cooperativa perdió el código de su facturador. Solo conserva un servicio
que recibe una lectura y devuelve el importe en céntimos enteros. Reemplázalo
con calculateBill(input). No necesitas conocimientos de tarifas eléctricas
reales: las reglas del servicio son ficticias y debes descubrirlas.

Los cinco campos son obligatorios. consumptionKwh es la energía importada en
un periodo de medición, de 0 a 2000. demandKw es la demanda máxima, de 0 a 100.
Ambos son enteros. hour es la hora local, de 0 a 23. solar indica generación
solar y business un contrato comercial. Cada lectura es independiente, sin
estado ni acumulación entre consultas. Cero es un valor válido.

Tienes 25 consultas exitosas y 3 evaluaciones oficiales. Las reglas permanecen
fijas para tu intento, pero los parámetros varían entre participantes. Puedes
usar AI. Las consultas duplicadas o fallidas no consumen presupuesto.

Trabaja con tu agente por rondas. Antes de cada ronda, elige qué hipótesis
investigar o qué cambio implementar. El agente puede proponer opciones; espera
tu respuesta antes de continuar y usa como máximo tres consultas nuevas por
ronda. Revisen los resultados juntos y decide el siguiente paso. Antes de cada
evaluación oficial, decide si gastar un intento en la solución presentada.
Las instrucciones para el agente están en AGENTS.md.

Usa input.json como punto de partida. Cambia una variable a la vez y prueba
los extremos, horarios e interacciones entre campos. No asumas que este
facturador aplica la fórmula del challenge de envíos. Si una variable no cambia
el resultado, prueba otros contextos antes de concluir que no influye. Separa
las reglas respaldadas por observaciones de las hipótesis pendientes y reserva
consultas para comprobar estas últimas.

andes challenge query --challenge power-grid --input input.json
andes challenge notebook --challenge power-grid
andes challenge notebook --challenge power-grid --format csv > observations.csv
andes challenge test --challenge power-grid --source bill.js
andes challenge evaluate --challenge power-grid --source bill.js

Los tests gratuitos comparan tu código con tu cuaderno. Coincidir con él no
certifica el puntaje oculto. La evaluación oficial mide coincidencias exactas
en 1000 lecturas ocultas con distintos consumos, demandas, horarios y contratos.
El puntaje y el error medio resumen muchas lecturas; por sí solos no identifican
qué regla falta ni confirman una hipótesis. El ranking conserva el mejor resultado.
A igualdad de aciertos, favorece menos consultas, menor tiempo de ejecución y luego la fecha del resultado.

Define calculateBill como función global, module.exports.calculateBill o
module.exports. Devuelve un número finito en céntimos enteros. No se permiten
imports, acceso a archivos ni llamadas de red. El source admite hasta 32768
caracteres. Este challenge no requiere review.json ni aprobación de navegador.
`;
