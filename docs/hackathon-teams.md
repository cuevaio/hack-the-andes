# Equipos, tracks y check-in

## Participantes

Necesitas una postulación aceptada y asistencia confirmada (`andes confirm`). Todos los comandos también funcionan con el alias `chofex`.

```sh
andes team                         # Tu equipo, integrantes, invitaciones y cupos
andes team create                  # Equipo de 1–4 personas; máximo 36 equipos
andes team invite                  # Correo principal verificado del invitado
andes team invites                 # Invitaciones recibidas dentro del CLI
andes team accept                  # Cambia de equipo en una sola operación
andes team decline
andes team leave
andes team remove                  # Solo integrantes sin check-in
andes team track                   # Elegir/cambiar track cuando esté habilitado
andes team list                    # Todos los equipos e integrantes
andes team tracks                  # Equipos por track
andes checkin                      # QR de ingreso; espera confirmación del admin
andes checkin --no-wait             # Mostrar QR sin esperar
andes checkin --status              # Consultar asistencia sin reemplazar el QR
```

Las invitaciones se identifican por correo pero se reciben y aceptan en el CLI, no mediante enlaces de correo. No se envía una notificación por email. No reservan espacio. Al aceptar se valida el cupo antes de abandonar el equipo anterior. Si falla, no cambia nada. Al quedar vacío, un equipo se elimina inmediatamente y libera su track. No hay capitán: cualquier integrante puede invitar y elegir track. Solo un integrante con check-in puede retirar a otro sin check-in. Una persona retirada conserva su participación y puede recibir otra invitación.

Para agentes o scripts, usa `--output json`. Las operaciones que requieren confirmación necesitan `--yes`; los identificadores de invitaciones/integrantes aparecen en `andes team`.

```sh
andes --output json team create --name "Cóndores"
andes --output json team invite --email "persona@example.com"
andes --output json team accept --invite "<invitation-id>" --yes
andes --output json team leave --yes
andes --output json team remove --member "<participant-id>" --yes
andes --output json team track --track environmental --yes
```

## Organización: sábado

1. Inicia sesión en `/admin/checkin` en cada teléfono de ingreso. Busca por nombre público o legal, correo o DNI/documento. Puedes filtrar **Todos**, **Sin check-in** o **Con check-in**, y ordenar por nombre o por hora de llegada. La lista y los contadores se actualizan cada diez segundos.
2. Para ingresar sin QR, verifica la identidad y foto, pulsa **Registrar llegada** y después **Confirmar llegada**. Solo se muestran los últimos cuatro caracteres del documento. Si falta la confirmación de asistencia, pide al participante que complete `andes confirm`; el ingreso seguirá bloqueado hasta entonces.
3. Como alternativa, el participante ejecuta `andes checkin`. Usa la cámara normal del teléfono para abrir su QR, o ingresa el código alternativo manualmente. El código dura cinco minutos; volver a generarlo invalida el anterior.
4. Verifica el nombre público y la foto confirmada. Pulsa **Confirmar llegada**. Escanear o previsualizar no registra asistencia. La confirmación persiste aunque el terminal se cierre. Tanto el ingreso manual como el QR conservan la primera hora de llegada y el admin que la confirmó; repetir la operación no reemplaza esos datos.
5. Da los diez minutos de networking. Los equipos ya pueden crearse antes del evento.
6. Después del briefing, abre `/admin/event` y pulsa **Abrir selección de tracks**. No existe un horario automático. Todos los integrantes deben tener check-in; si alguien no llegó, un compañero presente puede retirarlo. Un equipo de una persona sí puede elegir track.
7. Medio ambiente (`environmental`), seguridad (`security`) y transporte (`transport`) tienen doce cupos por track. La primera confirmación exitosa obtiene el cupo. Cambiar track solo libera el anterior si el nuevo se obtiene.
8. Cuando corresponda, pulsa **Cerrar selección de tracks**. Se bloquean elecciones/cambios de track, no los cambios de integrantes. Un integrante nuevo debe tener check-in para entrar en un equipo que ya eligió track.

`/teams` es una vista de solo lectura para participantes confirmados y admins, con actualización cada diez segundos. `/tracks` está disponible solo para admins y actualiza los cupos cada tres segundos. No muestran emails ni nombres legales. Los controles de organización están separados en `/admin/event` y `/admin/checkin`; requieren los permisos de admin existentes.

## Activación técnica

Antes de anunciar disponibilidad hay que aplicar explícitamente las migraciones `0032_tiny_plazm.sql` y `0033_team_operations.sql`, desplegar **primero el rate limiter** (nuevas políticas `event-read` y `event-write`), desplegar el servidor y publicar el CLI mediante el flujo aprobado de releases. La implementación por sí sola no activa producción. Sigue `deploy/README.md`; no ejecutes migraciones ni despliegues de producción sin aprobación.

**Prepara estas dependencias antes de fusionar o pushear a `main`**: ese push inicia el despliegue automático de la web y puede publicar el CLI. Desde una rama autorizada, despliega el Worker compatible, ejecuta `scripts/verify-shared-limiter.ts` (comprueba todas las políticas, incluidas las del evento) y aplica ambas migraciones. Solo después promueve el commit aprobado. No basta con planear estas tareas después del merge.

La selección de tracks se inicializa cerrada. Los comandos usan funciones transaccionales de PostgreSQL compatibles con el driver HTTP de Neon. Un bloqueo transaccional compartido serializa los cambios del evento; índices únicos y checks refuerzan los límites de cuatro integrantes y doce equipos por track. Solo se guardan hashes de códigos QR, y el admin que confirmó queda registrado.

Los endpoints de equipos y check-in tienen presupuestos propios para soportar a 100 participantes detrás de la misma IP del venue. El resto de endpoints conserva sus límites. El CLI y las vistas web consultan actualizaciones cada diez segundos, salvo `/tracks`, que actualiza cada tres segundos; los límites globales del evento siguen activos.
