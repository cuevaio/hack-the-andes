# Hack the Andes CLI

Command-line client for Hack the Andes.

## Install

```sh
npm install --global hacktheandes-cli@latest
```

También puedes instalar `chofex-cli`. Ambos paquetes instalan los comandos
`andes` y `chofex`, con los mismos subcomandos, configuración y sesión guardada.
Instala uno de los dos paquetes.

```sh
andes register
```

Para instalarlo dentro de un proyecto, usa `npm install hacktheandes-cli` y
ejecuta `npx andes register`.

El comando recomendado es `andes`. `chofex` sigue disponible por compatibilidad.

```sh
andes
andes whoami
andes update
andes upgrade
andes register
andes status
andes requirements
andes challenge list
andes challenge query --challenge black-box
andes challenge notebook --challenge black-box
andes challenge test --challenge black-box --source ./shipping.js
andes challenge evaluate --challenge black-box --source ./shipping.js
andes challenge ranking --challenge black-box
andes challenge init --challenge broken-agent
cd broken-agent && npm test
andes challenge test --challenge broken-agent --source ./scheduler.js
andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json
andes challenge ranking --challenge broken-agent
andes confirm
andes badge
andes badge regenerate
```

`andes update` and `andes upgrade` are interchangeable; both update the CLI
to the latest published version.

Las actualizaciones conservan el paquete instalado: `hacktheandes-cli` o
`chofex-cli`, independientemente del comando que uses.

Las copias instaladas también consultan npm cada vez que se inicia `andes` e
instalan una versión publicada más reciente antes de ejecutar el comando. Si
npm o la red no están disponibles temporalmente, se continúa con la versión
actual. Usa `CHOFEX_AUTO_UPDATE=0` para desactivar esta comprobación.

`andes register` collects and submits an application with full name, role,
optional phone number, bio, portfolio URL, shipped project, LinkedIn and GitHub
URLs, and Terms and Conditions. Use `--input` to submit a completed JSON
application.
Acceptance creates a default badge from the Clerk profile visible to reviewers.
`andes confirm` updates the public name, one-line description, and picture
while separately collecting the legal full name and venue details required for attendance. After confirmation,
`andes badge regenerate` can also update those public fields and the QR
destination without changing the submitted application.
The technical challenges do not block application submission, but they are
mandatory for admission. An application does not reserve a seat; organizers
select the strongest engineers from challenge rankings. Broken Agent requires a
participant-only browser handoff with passkey user verification before each
official evaluation. Every challenge slug resolves to the current server
version; legacy attempts do not count toward admission.

The public ranking is read-only at `https://hacktheandes.com/challenges`.

Run `andes` to see your current progress and the next command to run.
`andes challenge` also checks your application before showing the challenge guide.
Repeating `andes register` after submission shows your next step without submitting again.
After acceptance, run `andes confirm`; after confirmation, run `andes badge`.
Confirmation generates the badge automatically. Repeat `andes badge` if it is still processing.
Run `andes --help` for the full command reference. The welcome screen's
landscape uses colored terminal cells, with readable text that works with your
terminal's line spacing. It adapts to the terminal width and has a plain ASCII
fallback when color is disabled with `NO_COLOR`. JSON output and individual
command results omit the welcome screen.

For agent or script input, `andes schema --stage application` and
`andes schema --stage acceptance` print complete templates containing every
accepted JSON key. Validate a completed input file locally before submitting it:

```sh
andes --output json validate --stage application --input application.json
```

Validation does not contact the API, and a successful result does not echo input
values. Local validation errors include `acceptedFields` in JSON mode. The
`status` response already includes both the registration and its requirements;
use `requirements` only when requirements-only human output is preferred.
The CLI adds `data.nextStep` with `kind`, `message`, and `command` to registration
results and to home and challenge guidance. JSON output remains one versioned envelope.

Run `andes login` to authenticate. For automation, provide an OAuth access
token with `CHOFEX_TOKEN`.

### Authentication troubleshooting

If `andes login` succeeds but `whoami` or an authenticated challenge command
returns `AUTHENTICATION_REQUIRED`, first remove any token or API URL overrides
from the shell. In Bash or Zsh:

```sh
unset CHOFEX_TOKEN CHOFEX_API_URL
```

In PowerShell:

```powershell
Remove-Item Env:CHOFEX_TOKEN, Env:CHOFEX_API_URL -ErrorAction SilentlyContinue
```

Update by repeating the installation method you originally used. For npm:

```sh
npm install --global hacktheandes-cli@latest
```

For the standalone installer:

```sh
curl -fsSL https://hacktheandes.com/install | bash
```

Then renew the stored session and verify it:

```sh
andes --version
andes logout
andes login
andes --output json whoami
```

Versions before `0.1.140` used a retired API origin whose cross-origin redirect
removed the bearer token. Versions `0.1.140` through `0.1.145` call
`https://hacktheandes.com` but still mint OAuth tokens from the retired Clerk
application, so login can print success while `whoami` and `status` return
`AUTHENTICATION_REQUIRED`. Current releases (`0.1.146` and later) use
`https://clerk.hacktheandes.com`. If the API still responds with
`Authentication failed` after updating, share the CLI version, error code, and
request ID when asking for support. For a different local authentication error,
share its code and message instead. Never share the access or refresh token.

When applying again after a rejection, interactive registration pre-fills the
previous application's answers. Keep a value by pressing Enter, or press Ctrl+U
and type a replacement for an answer that needs to change.

Accepted participants must confirm which profile picture reviewers should use:
their Clerk picture, their GitHub avatar, or a custom upload. Interactive
confirmation prompts for the choice and local file path. For JSON input, set
`pictureSource` and pass `--picture /path/to/image` when its value is `upload`.
Uploads show percentage progress and accept JPEG, PNG, or WebP files up to 5 MB.

API requests use `https://hacktheandes.com` by default. Use `CHOFEX_API_URL` to
override the API URL when running against a local or preview Chofex instance.

Registration links use `https://hacktheandes.com` by default. Local or preview
environments can override that origin with `CHOFEX_PUBLIC_SITE_URL`.

## Verificar los paquetes npm

Desde la raíz del repositorio:

```sh
bun --filter chofex-cli build
bun --filter chofex-cli prepare-packages
bun --filter chofex-cli verify-packages
```

La verificación empaqueta e instala ambos paquetes en directorios temporales.
Comprueba los dos comandos, la ayuda de registro, la salida JSON y el paquete
que solicita cada actualización. El workflow de publicación ejecuta estos
mismos pasos antes de publicar ambos paquetes con la misma versión.
