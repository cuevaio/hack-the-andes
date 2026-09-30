# Cómo se escribe un deck de patrocinio — Hack the Andes

La doctrina. Qué vende un deck, en qué orden, con cuánto texto y con qué
números. Portada de The Next Craft (42 decks en producción) y adaptada a lo que
somos: **primera edición, una sede, ~100 asistentes**.

- **El motor** (cómo se monta un deck en código): [`docs/deck-system.md`](./deck-system.md)
- **Los números** (tiers, presupuesto): [`docs/budget-sponsors.md`](./budget-sponsors.md)
- **El insumo de contenido**: [`docs/sponsorship-deck-brief.md`](./sponsorship-deck-brief.md)

---

## 1. El principio

> **Un deck no vende espacio para un logo. Vende adopción medida, con evidencia.**

Un sponsor de devtools no compra visibilidad: compra que 100 personas
seleccionadas tengan sus créditos en la mano, un motivo para abrirlos, y un
reporte de lo que pasó. La visibilidad es el envoltorio, no el producto.

**Nada es obligatorio.** Ninguna herramienta entra en los requisitos de entrega.
Lo que se ofrece son tres formas concretas de aportar:

1. **Basic:** créditos para los 100, en el monto que el sponsor elija.
2. **Pro:** Basic más créditos para primer, segundo y tercer lugar.
3. **Premium:** Basic más merch para participantes. No incluye Pro por defecto.

Y con cualquiera de las tres, lo que de verdad nos diferencia: **el reporte**.
Un logo en una web no se puede medir; kits reclamados, cuentas creadas y
proyectos que lo nombran, sí.

### El marco que se usa

- *"Los 100 builders reciben tus créditos en el kickoff."*
- *"Pro suma créditos para los tres equipos del podio."*
- *"Premium suma merch para participantes sobre la base de créditos."*
- *"Al cierre te mandamos un reporte de qué se reclamó y qué se usó."*

### El marco que está prohibido

- "Logo en la web" como valor principal.
- "Exposición masiva", "alcance", "visibilidad de marca" como argumento central.
- Cualquier promesa de ingresos, conversión o pipeline.
- **Prometer adopción.** No la controlamos. Se mide después y se reporta; no se
  promete antes.
- Cualquier lenguaje de obligatoriedad: "requisito de entrega", "el 100% lo
  integra", "exclusividad de capa". Describe un modelo que ya no existe.

> **Nota sobre el inventario.** El brief lista siete contrapartidas —logo,
> post de anuncio, plantilla de imagen, banners, badges, menciones— y **las
> siete son visibilidad**. Sirven como relleno de tier, nunca como tesis. Si un
> deck nuestro no puede nombrar **qué créditos entran al kit, qué extensión
> elige el partner y qué se le va a reportar**, todavía no está listo para
> mandarse.

---

## 2. Los dos tipos de deck

### Deck general (`main` en ES, `main/en` en EN)

Cuando la categoría del partner todavía no está definida, o cuando se contacta
devtools en lote. Flujo:

1. Portada
2. Qué es Hack the Andes
3. **Cómo se filtra**
4. **El equipo** ← su historial no se confunde con el del evento (ver §4)
5. Datos del evento
6. Premios oficiales
7. **Por qué lo van a usar** ← Basic y Pro (ver §9)
8. **Una por categoría** ← la exclusividad, y de dónde sale ahora
9. **Tiers**
10. Por qué patrocinar aquí y no en otro evento
11. Qué se reporta después
12. Cierre

Es el orden de `content/decks/main/`. Los slides 7 y 8 van **antes** de los
tiers a propósito: sin entender que se venden capas del stack, y cuáles, los
precios del 9 no significan nada.

El 8 existe porque la primera pregunta de un devtool es *¿con quién comparto el
kit?*, y un slide de tiers que muestra cupos no la contesta. Nombra las cinco
categorías y dice que se cierra una por partner.

### Deck a partner específico

Cuando hay una tesis de por qué *esa* empresa. Flujo:

1. Portada con la tesis específica
2. Por qué este partner y por qué ahora
3. Qué es Hack the Andes
4. Datos y audiencia
5. Cómo se filtra
6. **La categoría que el partner cierra** — nombrada: "inferencia",
   "base de datos", "auth". Y qué queda cerrado para la competencia.
7. Cómo llega su producto a un equipo: el kit, la cuenta, y en qué punto de las
   30 horas lo abrirían
8. Ejemplos concretos de lo que se construiría con su producto
9. Plan de activación (créditos del podio o merch)
10. Métricas que se van a reportar
11. **Inversión**
12. Qué incluye
13. Cierre

**El test de intercambiabilidad:** si le cambias el nombre a la empresa en el
slide 2 y el argumento sigue teniendo sentido, el deck no sirve. Es un deck
general con un logo pegado.

---

## 3. El ask repetible

**No se pide efectivo, y no se fija una cifra.** Cada devtool elige cuánto
crédito aporta por persona. El deck define destinatarios y formato, no un monto
que tendría que servirle por igual a productos con economías distintas.

La conversación separa dos decisiones: cuánto aporta a Basic y qué extensión
elige, si alguna:

| Tier | Lo que da |
| --- | --- |
| **Basic** | Créditos para los 100 participantes, en el monto que el sponsor elija |
| **Pro** | Basic + créditos para 1º, 2º y 3º lugar |
| **Premium** | Basic + merch para participantes |

Basic es la base de los otros dos. Pro y Premium son extensiones distintas:
Premium no incluye los créditos del podio salvo que se acuerde también Pro.

Slots y contrapartidas vienen de [`budget-sponsors.md`](./budget-sponsors.md),
que es la única fuente.

**Un solo ask por mensaje.** El deck puede mostrar los tres tiers; el correo que
lo acompaña pide uno.

> **Este deck es para devtools.** Una empresa que quiere poner dinero, un lugar
> de comida, alguien que pone merch o la sede no compran nada de esto: no tienen
> créditos, no les sirve un reporte de uso, y "tu herramienta en manos de 100
> builders" no les dice nada.
>
> Ésos van por **`content/decks/partners`**, que vende otra cosa —estar en la
> sala— con la escalera en efectivo de `budget-sponsors.md` §5.

---

## 4. Qué es nuevo y qué no

Esta sección decía que no teníamos track record y que el filtro era su
sustituto. **Estaba mal, y se estaba regalando el mejor argumento del deck.**

The Next Craft lo corre **el mismo equipo** que Crafter Station. Bogotá y Lima ya
pasaron, con marcas grandes en la pared de sponsors. Lo nuevo es el formato de
Hack the Andes, no la gente que lo monta.

La distinción tiene que ser exacta en los dos sentidos, porque las dos mitades
se pueden verificar:

- ✅ *"Primera edición de este formato."*
- ✅ *"No es nuestra primera hackathon: Bogotá y Lima."*
- ❌ *"Primera edición, sin track record."* — falso, y encima renuncia a la
  respuesta de la objeción que todo sponsor tiene con un evento nuevo: *¿ustedes
  saben hacer esto?*
- ❌ Cualquier número de ediciones, asistentes o marcas que no venga de alguien
  que los contó.

**Las fotos son la prueba.** Van en escala de grises, como plancha de un slide
donde la foto es el tema —no de fondo bajo un párrafo, que es donde no se leen
ni ellas ni el texto— y los logos que aparecen en la pared del fondo son parte
de la evidencia, no un accidente que haya que recortar.

Y el **filtro sigue siendo argumento**, solo que ya no como sustituto de nada:

- Aplicación por CLI (`andes register`) o por agent — el formulario ya es un
  filtro técnico.
- Se revisa **lo que la persona ya construyó**, no su CV.
- Corte explícito en 100: no es un evento abierto.

**Regla:** el equipo tiene historial y el evento no. Ningún deck confunde los
dos, en ninguna de las dos direcciones.

---

## 5. Métricas

Tres columnas, no dos, y la del medio es la que se olvidaba.

| ✅ Contamos nosotros | 🤝 Nos lo comparte el partner | ❌ No se promete |
| --- | --- | --- |
| Kits entregados y reclamados | Cuentas activadas | Ingresos |
| Cuentas creadas con nuestro código | Créditos consumidos | Valor de pipeline |
| Proyectos que lo nombran en la entrega | API calls, minutos, runs | Tasa de conversión |
| Demos que lo muestran, repos | Retención posterior | Contrataciones |
| Merch entregado a participantes | | Cobertura de prensa |

La primera columna la instrumentamos nosotros y se puede prometer. **La segunda
no.** Sale de los sistemas del partner, y un deck que la promete está
comprometiendo un dato que no controla — se pide en el trato, con la fórmula
*"si nos compartís el consumo, va en el mismo reporte"*.

La tercera depende del negocio del sponsor y no se toca nunca. Prometerla es lo
que quema una relación para la segunda edición.

Si un deck menciona una métrica, de qué columna sale va en el mismo slide.

Si un deck menciona una métrica, el plan de cómo se mide va en el mismo slide o
en el siguiente. Una métrica sin método de medición es una promesa.

---

## 6. Reglas de densidad

> **Presupuesto: 40 palabras de prosa por slide, máximo.**
> **Los números cargan el slide. La prosa etiqueta los números.**

- Si un slide necesita más de un `Lead`, un grid y una frase de cierre, se parte
  en dos.
- Prohibidos dos bloques de prosa en un mismo slide.
- Una frase con "porque" o "así que" son dos frases. Pártelas o borra una.
- El razonamiento detrás de una oferta va en el correo, no en el slide.
- Todo slide que pueda abrir con un número, abre con un número.
- **Cut test:** borra cada frase y mira cuál se extraña de verdad. Las que no,
  no vuelven.

**Hay dos excepciones, y las dos se cuentan solas.**

**La slide de la oferta.** Lleva dos ejes —lo que el sponsor da y lo que
recibe— y eso no entra en 40 palabras sin romper la oferta. Hoy está en 51. El
presupuesto existe para que nadie escriba párrafos en un slide, y ahí no hay uno
solo: son etiquetas de tres columnas. Si alguna vez pasa de ~55, lo que sobra es
contrapartida, no palabras.

**La slide del equipo.** Está en 48, y diez de esas palabras son nombres
propios: cuatro sedes y seis marcas. Un nombre propio no se lee, se reconoce —
es la evidencia misma, no prosa sobre la evidencia. La prosa de ese slide son 19
palabras. Si alguna vez hay que recortar ahí, se recortan marcas, no frases.

---

## 7. El slide de cierre

Forma fija: centrado, sin grid ni tarjetas. Headline + **un solo** próximo paso +
`LogoRow` de los organizadores + fecha y sede + `Ready`.

El headline **enuncia el cambio, nunca un resultado prometido**:

- ✅ "De consumir herramientas a construir con ellas."
- ❌ "Tu producto será el favorito de los devs peruanos."

El segundo promete algo que el emisor no controla, y un lector senior descuenta
el deck completo por esa línea.

---

## 8. Hechos canónicos

No inventar cifras fuera de esta lista. La fuente es
`apps/web/components/landing/content.ts` para los montos en efectivo, y esta
sección para la composición completa del podio.

| Dato | Valor |
| --- | --- |
| Marca | Hack the Andes |
| Sponsor principal | Chofex · organiza Crafter Station |
| Fechas | 17–18 oct 2026 |
| Sede | Lima, Perú · presencial |
| Duración | 30 horas |
| Equipos | 1–4 personas, se puede aplicar solo |
| Cupo | **100** (`seatCount`, publicado) |
| Premios | 1º US$2.000 Chofex · 2º US$500 Chofex · 3º créditos de un sponsor devtool |
| Historial del equipo | Guatemala · El Salvador · Colombia · Perú · más de 500 builders |
| Aplicación | CLI (`andes register`) o agent |
| Selección | lo que ya construiste, cómo lo explicas, qué propuesta traes |
| Consejo | 5 jurados + 5 mentores, roster sin anunciar |
| Challenges | **3, sellados** hasta el kickoff del 17 oct ⚠️ ver §9 |

**Ningún deck sale con una cifra que no esté en esta tabla.** Es lo primero que
un sponsor verifica contra la landing.

> El pool de viajes de US$300 y los tracks `T-01`/`T-02` **ya no existen**; los
> premios son $2.500 y los tracks son 3 challenges sellados. Si ves esas cifras
> en un borrador, está desactualizado.

---

## 9. El kit, el podio y el merch

**Los partners no son dueños de challenges.** Los 3 challenges son producto de
participante: sellados hasta el kickoff, elegidos por cada equipo, sin marca
encima. Y **tampoco son dueños de una obligación**: ninguna herramienta es
requisito de entrega.

Lo que un partner elige son una base y una de dos extensiones.

### 1. Créditos en el kit

Los 100 aceptados reciben el kit oficial en el kickoff. Los créditos del partner
van ahí. Uso opcional, y eso se dice en el deck sin adornos: *quien lo necesite,
lo usará.*

**Una por categoría.** El kit lleva una sola herramienta por categoría
—inferencia, datos, auth, infra, observabilidad— para que los créditos de un
partner no se diluyan entre cuatro de lo mismo. La exclusividad sigue siendo
real y sigue cerrando ventas; lo que cambió es la razón: antes era *nadie más
puede ser obligatorio en tu capa*, ahora es *tus créditos no compiten con otros
tres iguales*.

### 2. Pro: créditos para el podio

A partir de Pro, el partner mantiene los créditos de Basic para los 100 y suma
créditos para primer, segundo y tercer lugar. Chofex paga los US$2.500 en
efectivo de los dos primeros; el devtool aporta créditos, no reemplaza ese cash.

El tercer puesto no lleva efectivo: su premio son los créditos del sponsor
devtool. Pro también da créditos a los dos puestos que ya reciben cash.

### 3. Premium: merch

Premium mantiene Basic y suma merch para participantes. Es una alternativa a
Pro, no el siguiente peldaño: no incluye créditos para el podio por defecto.

### Lo que esto compra, dicho con números

| Oferta | Lo que se puede prometer |
| --- | --- |
| Créditos en el kit | **100 kits entregados**; claims y cuentas creadas |
| Pro: créditos para el podio | créditos asignados a 1º, 2º y 3º; mención en la premiación |
| Premium: merch | unidades entregadas a participantes; registro de entrega |

Ninguna fila promete adopción. La primera es lo único garantizado por
construcción: el kit se entrega a los 100 porque nosotros lo entregamos.

### El riesgo que hay que decir en voz alta

**El reporte es lo mejor que vendemos y el dato de consumo no es nuestro.**
Kits reclamados, cuentas creadas y proyectos que lo mencionan los contamos
nosotros. Créditos consumidos y API calls salen de los sistemas del partner. El
deck promete solo lo primero, y lo segundo se pide como parte del trato: *si nos
compartís el consumo, va en el mismo reporte.* Prometer un número que depende de
un tercero es cómo se quema una relación para la segunda edición.

---

## 10. Reglas visuales

Identidad **Hack the Andes**, no Chofex. Chofex aparece como sponsor principal; no
pinta la paleta. (Regla ya cerrada en el brief, no reabrir.)

- Página negra, tipografía blanca y gris. La piel `terrain` es monocroma.
- `terrain` declara sus propios roles acromáticos; no hereda el cobalto ni el
  rojo del landing.
- **Los roles se nombran por token, nunca por color.** Los nombres propios de la
  paleta cambian con cada rediseño; los roles no.
- Retícula compartida de 1px, sin gaps y sin radius (`.deck-table` / `.deck-cell`).
- Sombras duras (`0 2px 0`), nunca blur.
- La cara de marca para títulos; IBM Plex Mono para chrome y etiquetas.
- Los gradientes se reservan para velos funcionales sobre las láminas. Sin
  glassmorphism, emoji decorativo ni ilustración genérica de SaaS.

---

## 11. Checklist antes de mandar un deck

- [ ] La tesis del slide 2 **falla** el test de intercambiabilidad.
- [ ] El tier es inequívoco: Basic, Pro (podio) o Premium (merch).
- [ ] Ninguna métrica de la columna 🤝 de §5 aparece como promesa.
- [ ] Ningún slide habla de obligatoriedad, requisito de entrega ni exclusividad
      de capa: describen un modelo que ya no existe.
- [ ] El plan de activación es ejecutable con la gente y el tiempo que hay.
- [ ] Hay un ask limpio y un fallback.
- [ ] Los beneficios son concretos, no adjetivos.
- [ ] Toda métrica prometida está en la columna ✅ de §5.
- [ ] Los hechos canónicos coinciden con `content.ts`.
- [ ] La fecha es la correcta.
- [ ] Ningún slide pasa de 40 palabras de prosa (salvo oferta y equipo, § 6).
- [ ] El cierre enuncia un cambio, no promete un resultado.
- [ ] **El deck se entiende sin nadie narrándolo en vivo.**
