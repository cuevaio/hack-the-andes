# Rúbrica del jurado de Hack the Andes

La versión completa de lo que las slides `18-rubric` y `19-score` del deck de kickoff
(`/deck/onboarding`) resumen para los participantes. Si cambia un peso o un
criterio, cambia en los dos lugares.

**Cómo se usa.** Cada jurado puntúa cada criterio de 1 a 5 después de la demo.
El puntaje de un equipo es la suma ponderada, sobre 5, promediada entre jurados.
Empate en el total: gana el mejor promedio en *Complejidad técnica*; si
persiste, en *Funciona*. El bonus por tracción se suma antes de comparar.

Lo técnico pesa 75%: complejidad, que funcione y calidad. Se puntúa la
capacidad del equipo y la dificultad de lo que construyó en 30 horas.

Todo se construye en 30 horas con software, APIs y datos abiertos; no se
requiere hardware especial.

## Formato de la demo

Cada equipo tiene 5 minutos: 3 de demo y 2 de preguntas del jurado. Al
minuto 3 se corta la demo. Formato sugerido a los equipos: 30 segundos de
problema, 2 minutos de demo en vivo y 30 segundos de cómo está hecho.

## Requisitos para ser evaluado

Se evalúa una demo en vivo. Un equipo entra a la rúbrica solo si cumple
los tres requisitos:

1. **Desplegado.** El producto corre en una URL pública. Localhost no cuenta.
2. **Demo en vivo.** Se muestra el producto en uso. Slides solas, un pitch,
   mockups o un video grabado no cuentan.
3. **Código en GitHub.** El repo se entrega junto con la URL.

La hora límite es el domingo 18 a las 09:00. Todo se entrega con
`andes project submit`: URL desplegada, repo de GitHub,
URL de la presentación y descripción. La organización abre los links desde su
propio equipo.

| Criterio | Peso | Pregunta del jurado |
| --- | --- | --- |
| Complejidad técnica | 30% | ¿Qué tan difícil es lo que construyeron, y lo resolvieron ellos? |
| Funciona | 25% | ¿Lo que vi en vivo, desde la URL pública, funciona en su flujo completo? |
| Calidad técnica | 20% | ¿El código en GitHub es sólido y aguanta errores y casos borde? |
| Problema e impacto | 15% | ¿Ataca un problema del track para un usuario que existe y lo usaría? |
| Claridad | 10% | ¿El equipo explica sus decisiones técnicas y tradeoffs? |

## Niveles

### Complejidad técnica (30%)

| 1 | 3 | 5 |
| --- | --- | --- |
| Un wrapper de una sola API o un CRUD sin lógica propia. | Integra varias piezas (APIs, datos, un modelo) con lógica propia en al menos una. | Resuelve un problema técnico difícil: procesa datos reales, orquesta modelos o servicios, o diseña una arquitectura no trivial, y el equipo explica cómo lo hizo. |

### Funciona (25%)

| 1 | 3 | 5 |
| --- | --- | --- |
| El flujo principal falla en vivo o se salta con pasos explicados. | Corre en vivo desde la URL pública el flujo principal, con pasos simulados o datos de juguete. | El flujo completo corre en vivo con datos reales o abiertos, y aguanta una pregunta fuera del guion. |

### Calidad técnica (20%)

| 1 | 3 | 5 |
| --- | --- | --- |
| Código frágil o pegado; secretos en el repo; depende de un servicio sin entender qué hace. | Estructura razonable, con atajos visibles y poco manejo de errores. | Código ordenado, manejo de errores y casos borde, datos y credenciales bien tratados. |

### Problema e impacto (15%)

| 1 | 3 | 5 |
| --- | --- | --- |
| Tema genérico, sin usuario ni track claro. | Problema del track con un usuario plausible. | Usuario específico, evidencia de que el problema existe y un camino creíble para que lo use la semana siguiente. |

### Claridad (10%)

| 1 | 3 | 5 |
| --- | --- | --- |
| No se entiende qué construyeron. | Se entiende el qué; las decisiones técnicas quedan cortas. | Explica qué construyeron, por qué esa arquitectura y qué dejaron fuera. |

## Bonus por tracción

Se suma por encima del puntaje ponderado, hasta +0,5. El máximo total pasa a
5,5. Lo decide el jurado con la evidencia que el equipo muestre en la demo o
registre con `andes project update`. Sin evidencia verificable, el bonus es 0.

| Bonus | Qué se necesita |
| --- | --- |
| 0 | Sin usuarios fuera del equipo, o sin evidencia. |
| +0,25 | Personas fuera del equipo usaron el producto durante el hackathon, y se ve: registros, mensajes, respuestas o datos en la base. |
| +0,5 | Uso claro y repetido: varias personas que vuelven, volumen visible, una lista de espera real o un pago. |

La evidencia se muestra desde el producto o su panel. Capturas de pantalla
solas o métricas sin fuente no cuentan. Usuarios inventados, cuentas del
mismo equipo o tráfico automatizado anulan el bonus.

## Hoja de puntaje

| Equipo | Track | URL + repo ✓ | Complejidad ×0.30 | Funciona ×0.25 | Calidad ×0.20 | Problema ×0.15 | Claridad ×0.10 | Base /5 | Tracción +0,5 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | |
