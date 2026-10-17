# Avances y entregas de proyectos

## Modelo y decisiones

Los proyectos pertenecen al equipo existente. No tienen un segundo nombre ni un capitán. Una entidad de proyecto independiente añadiría otra identidad que los participantes tendrían que mantener; se eligió una entrega por equipo y una bitácora compartida.

El CLI consulta el estado de la entrega, combina los campos proporcionados y envía la versión observada. PostgreSQL compara `expectedUpdatedAt` bajo el mismo bloqueo del evento que protege los cambios de integrantes. Una edición concurrente devuelve `PROJECT_CHANGED` sin sobrescribir nada. Los cambios de equipo también se validan con `expectedTeamId`.

Los avances son entradas Markdown con autor público y fecha. La salida de un autor no elimina sus entradas. Cuando sale el último integrante, un trigger archiva la entrega y toda la bitácora antes de eliminar el equipo activo. El panel de organización muestra los equipos disueltos en un archivo privado que no aparece en la galería pública. El cupo y el track quedan libres.

La galería inicia oculta. Se publica y se oculta manualmente en `/admin/event`; no hay una apertura automática el domingo. La función de lectura pública devuelve una lista vacía mientras está oculta. Los detalles públicos usan esa misma lectura. La organización ve también los equipos sin entrega y sus avances desde el panel existente. No se agregaron notificaciones por email ni una nueva función de acceso para mentores o jurados; la revisión usa los permisos de organización existentes.

## Comandos para participantes

```sh
andes project
andes project update --message "Decidimos priorizar el flujo de búsqueda. Necesitamos validar los datos."
andes project update --file ./avance.md
andes project updates
andes project submit --deployment-url https://app.example --presentation-url https://slides.example --file ./proyecto.md
andes project submit --presentation-url https://slides-final.example
andes team rename --name "Nuevo nombre"
```

Publicar un avance devuelve únicamente la nueva entrada y el total. `project` consulta un resumen sin el contenido de los avances; `project updates` carga el historial completo. El cambio de nombre usa la acción de equipos y devuelve `TeamState`. Los errores de validación incluyen `error.details.issues` con el campo y su motivo. Los servicios comparten la validación y el acceso a datos del evento en `lib/event/database.ts`.

Los agentes usan `andes --output json project ...`. La primera entrega requiere despliegue, presentación y descripción Markdown. Las ediciones posteriores pueden cambiar campos individuales. Ante `PROJECT_CHANGED`, consulta de nuevo y decide qué cambios conservar antes de reintentar. Ante un error de red al publicar un avance, consulta la bitácora antes de repetirlo.

La [guía para equipos](/guide) y las [condiciones de entrega](/participation-terms) explican que los participantes no conectarán sus laptops. La organización abrirá la presentación y aplicación desde las URLs entregadas.

## Verificación y activación

Ejecuta `bash scripts/verify-hackathon-projects.sh` para comprobar contratos, migraciones, permisos, galería oculta, conflictos y comandos reales del CLI. El script usa bases de datos locales de prueba y servidores HTTP de prueba; no publica ni migra producción.

Antes de activar esta funcionalidad, aplica explícitamente la migración `0034_messy_cobalt_man.sql` y `0035_project_review_fixes.sql`, después de las migraciones existentes, y despliega el servidor compatible. Publica el CLI mediante `.agents/skills/release-cli/SKILL.md` y el workflow aprobado. Mantén la galería oculta hasta la decisión de la organización. Lee `deploy/README.md` para las operaciones de producción. Este cambio no ejecuta despliegues ni publicaciones.

Las rutas nuevas reutilizan los presupuestos `event-read` y `event-write`. El Worker compatible con estos presupuestos debe estar desplegado antes del servidor, igual que en la activación de equipos. La fuente distribuida de la skill está en `skills/chofex-hackathon`; la copia instalada canónica en esta máquina está en `~/.agents/skills/chofex-hackathon`. Ambas incluyen las instrucciones de avances y entrega.
