# Guía para equipos

Hack the Andes se realiza el 17 y 18 de octubre de 2026 en Lima. Esta guía explica cómo formar tu equipo, acceder a créditos, compartir avances, entregar tu proyecto y preparar la evaluación con el CLI, por tu cuenta o con ayuda de un agente.

## Prepara tu equipo

Completa tu confirmación de asistencia con `andes confirm`. Consulta tu equipo con `andes team`. Todos los integrantes tienen los mismos permisos para publicar avances y actualizar la entrega.

El proyecto usa el nombre del equipo. Para cambiarlo, ejecuta `andes team rename --name "Nuevo nombre"`. No necesitas inventar otro nombre para la entrega.

## Check-in y créditos

Al llegar, muestra el QR de `andes checkin` a un organizador. También pueden buscarte por nombre, correo o DNI en el panel de ingreso. La llegada queda registrada cuando el organizador verifica tu identidad y confirma el check-in; generar el QR no basta.

Después del check-in, consulta los créditos y beneficios de los sponsors:

```sh
andes checkin --status
andes credits
```

`andes credits` muestra los beneficios, códigos disponibles, enlaces e instrucciones de canje. Cada proveedor tiene sus propias condiciones, fechas y cupos. Revisa las instrucciones antes de activar un plan. Los beneficios no se canjean automáticamente al ejecutar el comando.

Si aparece `CHECKIN_REQUIRED`, pide a un organizador que confirme tu llegada y vuelve a consultar. Puedes pedirle a tu agente que ejecute `andes --output json credits`. No publiques los códigos en tu bitácora ni en la descripción del proyecto.

## Mantén el foco

Antes de ampliar el alcance, conversa con tu equipo:

- ¿Quién tiene el problema y cómo lo resuelve hoy?
- ¿Cuál es la acción más importante que debe poder completar esa persona?
- ¿Qué evidencia tenemos de que la solución le ayuda?
- ¿Qué nos bloquea ahora y qué ayuda concreta necesitamos?
- ¿Qué podemos dejar fuera para demostrar una solución que funcione?

Prueba el recorrido principal desde una sesión nueva. Prioriza una demostración que otra persona pueda usar y entender.

## Comparte avances con mentores y jurado

Publica un avance después de una decisión importante, una prueba con usuarios, una demo funcional o un bloqueo que necesite ayuda. Explica qué cambió, por qué y cuál es el siguiente paso. No hace falta narrar cada cambio de código.

```sh
andes project update \
  --message "Probamos el flujo con dos personas.
Simplificamos el registro y priorizamos la búsqueda.
Necesitamos ayuda para validar los datos de transporte."
andes project update --file ./avance.md
andes project updates
```

Los avances forman una bitácora compartida del equipo con autor y fecha. La organización puede consultarlos sin esperar a que entregues el proyecto. Publicar un avance lo guarda para revisión; no garantiza una respuesta inmediata ni envía un correo.

Puedes pedirle a tu agente: "Revisa lo que hemos construido y envía un avance a los mentores de Hack the Andes, con nuestras decisiones, bloqueos y próximos pasos". El agente debe usar hechos que pueda verificar, sin inventar resultados ni incluir secretos.

## Entrega tu proyecto desde temprano

La entrega necesita estos datos:

- La URL del despliegue de la aplicación funcionando.
- La URL de la presentación. Puede ser Canva, Google Slides o una presentación hecha con código.
- La URL del repositorio de GitHub, por ejemplo `https://github.com/equipo/proyecto`.
- Una descripción del proyecto en Markdown. Explica el problema, para quién es, cómo funciona y qué limitaciones tiene.

No conectarás tu laptop al equipo de presentación del evento. La organización abrirá los enlaces entregados desde su propio equipo. Comprueba que la aplicación y la presentación funcionen en una ventana privada, sin tu sesión iniciada, sin permisos pendientes y sin depender de archivos locales. Prepara un recorrido que se pueda mostrar desde esos enlaces.

Escribe la descripción directamente al entregar. También puedes usar `--file ./proyecto.md` en lugar de `--description` si prefieres un archivo Markdown:

```sh
andes project submit \
  --deployment-url https://tu-app.example \
  --presentation-url https://tu-presentacion.example \
  --github-url https://github.com/equipo/proyecto \
  --description "Resolvemos este problema para estas personas. La demo permite probar el flujo principal."
andes project
```

Puedes entregar cuando tengas los cuatro datos y corregirlos después. No esperes al último momento. Por ejemplo, cambia solamente el enlace de la presentación:

```sh
andes project submit --presentation-url https://tu-presentacion-final.example
```

Cualquier integrante puede modificar la misma entrega. Coordina los cambios con tu equipo. Para agentes, agrega `--output json` antes de `project`; el resultado confirma qué datos guardó el servidor.

## Prepara la presentación y evaluación

Cada equipo dispone de **tres minutos de pitch y dos minutos de preguntas**. Prepara una demostración que puedas presentar desde los enlaces entregados, usando la computadora de la organización.

Organiza el pitch alrededor del problema, las personas que lo tienen, la solución funcionando y la evidencia que recogiste. Explica qué construyeron, qué decisiones técnicas tomaron y qué limitaciones siguen pendientes. Separa lo que ya funciona de lo que todavía es una idea.

Cuando la organización abre la evaluación, se guarda una copia de las entregas, los enlaces y las bitácoras para el jurado. Completa y revisa tu entrega antes de ese momento. Los cambios posteriores no actualizan la copia que ya recibió el jurado. Sigue las indicaciones de la organización para tu turno.

### Rúbrica del jurado

Cada jurado asigna una nota entera del **1 al 5** en cada criterio:

- **Tracción, 30%.** Se valora la evidencia externa. Un 1 corresponde a no tener evidencia; un 3, a entrevistas o señales verificables de interés y aprendizaje; un 5, a uso real, retención o demanda sólida con evidencia. Muestra qué probaste con personas y qué aprendiste.
- **Esfuerzo técnico, 40%.** Un 1 corresponde a una plantilla con cambios mínimos o sin funcionamiento; un 3, a un producto funcional con lógica e integraciones propias; un 5, a ingeniería sólida, decisiones justificadas y problemas complejos resueltos. Usar IA no resta puntos por sí solo. Explica tus decisiones y demuestra el recorrido principal.
- **Pitch, 30%.** Un 1 corresponde a un problema o solución poco claros; un 3, a una explicación y demostración comprensibles; un 5, a una propuesta convincente, una demostración clara y respuestas precisas.

La nota de cada jurado se calcula sobre 100: tracción × 6 + esfuerzo técnico × 8 + pitch × 6. Por ejemplo, recibir 3, 4 y 5 da 80 puntos. El resultado del equipo es el promedio de las evaluaciones enviadas por jurados activos; una evaluación pendiente no cuenta como cero.

## Revisa lo que se compartirá

La [galería de proyectos](/projects) muestra las entregas cuando la organización habilita su publicación. Cada proyecto incluye su descripción, enlaces y bitácora, con el nombre público de quien escribió cada avance y su fecha. No hay una hora de apertura automática anunciada. Sigue las indicaciones de la organización para el horario de presentación.

Trata las descripciones y los avances como contenido que se hará público. Excluye claves, tokens, datos personales de usuarios y material que tu equipo no tenga permiso de compartir.

Consulta las [condiciones de entrega y presentación](/participation-terms), los [términos del evento](/terms) y la [política de privacidad](/privacy).

Si sale el último integrante, el equipo se disuelve y libera su cupo y su track. La organización conserva la entrega y la bitácora en un archivo privado. Ese archivo no aparece en la galería pública ni se transfiere al nuevo equipo.


## Comandos durante el evento

`andes` y `chofex` son alias del mismo CLI. Los comandos sin los datos necesarios te los preguntan en una terminal interactiva.

Para preparar tu acceso y mostrar tu ingreso:

```sh
andes update                     # Actualizar el CLI y la skill
andes login                      # Iniciar sesión
andes whoami                     # Consultar la cuenta activa
andes status                     # Consultar tu postulación y asistencia
andes confirm                    # Completar o actualizar la confirmación
andes badge                      # Ver tu carnet
andes checkin                    # Mostrar QR y esperar al organizador
andes checkin --no-wait           # Mostrar QR sin esperar
andes checkin --status            # Consultar si ya tienes check-in
andes credits                    # Beneficios después del check-in
```

Para formar el equipo y elegir track:

```sh
andes team
andes team create --name "Cóndores"
andes team rename --name "Nuevo nombre"
andes team invite --email persona@example.com
andes team invites
andes team accept
andes team decline
andes team leave
andes team remove
andes team list
andes team tracks
andes team track
```

`team` muestra tu equipo, integrantes, invitaciones y cupos. `invites` muestra las invitaciones recibidas. `accept` acepta una y cambia de equipo en una sola operación; `decline` la rechaza. `leave` abandona tu equipo. `remove` permite a un integrante con check-in retirar a otro que todavía no lo tiene. `list` muestra todos los equipos y `tracks` los agrupa por track.

Para crear o unirte a un equipo necesitas una postulación aceptada y asistencia confirmada. La organización abre la selección de tracks desde su panel. Para elegir o cambiar track, todos los integrantes actuales necesitan check-in. Los valores de `--track` son `environmental`, `security` y `transport`. Hay doce cupos por track, equipos de una a cuatro personas y hasta 36 equipos activos.

Para compartir el trabajo y entregar:

```sh
andes project
andes project update \
  --message "Terminamos el flujo y desplegamos la demo."
andes project update --file ./avance.md
andes project updates
andes project submit \
  --deployment-url https://app.example \
  --presentation-url https://slides.example \
  --github-url https://github.com/equipo/proyecto \
  --description "Qué construimos, para quién y cómo funciona."
andes project submit \
  --deployment-url https://app.example \
  --presentation-url https://slides.example \
  --github-url https://github.com/equipo/proyecto \
  --file ./proyecto.md
andes project submit --presentation-url https://slides-final.example
```

`project` muestra la entrega actual y el número de avances. `project update` publica solamente el nuevo avance, sin repetir el historial. `project updates` consulta la bitácora completa. `project submit` crea o actualiza la entrega. Los campos omitidos conservan el valor guardado. Si otro integrante la editó al mismo tiempo, el CLI indica el conflicto sin sobrescribir sus cambios.

Para agentes, usa JSON y pasa explícitamente los identificadores. `--yes` confirma cambios de membresía y track sin preguntas:

```sh
andes --output json team accept --invite INVITATION_ID --yes
andes --output json team decline --invite INVITATION_ID --yes
andes --output json team leave --yes
andes --output json team remove --member PARTICIPANT_ID --yes
andes --output json team track --track transport --yes
andes --output json project update --message "Corregimos el bloqueo y desplegamos."
```

Los identificadores aparecen en `andes --output json team`. Usa `andes --help`, `andes team --help` y `andes project --help` para consultar opciones. `andes logout` cierra la sesión.
