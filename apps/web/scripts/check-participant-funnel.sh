#!/usr/bin/env bash
set -euo pipefail

# Start preview-participant-history.tsx in another terminal before this check.
browser() { bunx agent-browser --session participant-funnel-check "$@"; }
trap 'browser close >/dev/null' EXIT
funnel() {
  browser wait --fn 'document.querySelector("[aria-labelledby=candidate-funnel-title]")?.getAttribute("aria-busy") === "false"'
  browser eval "(() => { const actual=[...document.querySelectorAll('[aria-labelledby=candidate-funnel-title] .tabular-nums')].map(el=>Number(el.textContent));if(JSON.stringify(actual)!==JSON.stringify([$1]))throw Error('Wrong funnel: '+actual);return true; })()"
}
browser --args --no-sandbox open http://127.0.0.1:4321/admin/participants
funnel '27,22,21,19,10,1'
browser find role link click --name 'Página siguiente'
browser wait --fn 'new URLSearchParams(location.search).get("page") === "2"'
funnel '27,22,21,19,10,1'
browser select 'select[name=country]' outside_peru
browser wait --fn 'new URLSearchParams(location.search).get("country") === "outside_peru" && !new URLSearchParams(location.search).has("page")'
funnel '7,5,5,5,3,0'
browser select 'select[name=status]' approved
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 3'
funnel '7,5,5,5,3,0'
browser find role button click --name 'Editar país de Persona 4: Colombia'
browser find placeholder 'Buscar país…' fill 'Perú'
browser find role option click --name 'Perú'
browser find role button click --name 'GUARDAR' --exact
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 2'
funnel '6,4,4,4,2,0'
browser select 'select[name=country]' PE
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 6'
funnel '17,14,13,12,6,1'
browser find role button click --name 'Editar país de Persona 4: Perú'
browser find placeholder 'Buscar país…' fill 'Colombia'
browser find role option click --name 'Colombia'
browser find role button click --name 'GUARDAR' --exact
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 5'
funnel '16,13,12,11,5,1'
browser select 'select[name=ranking]' broken-agent
browser wait --fn 'new URLSearchParams(location.search).get("ranking") === "broken-agent"'
funnel '16,13,12,11,5,1'
browser back
browser wait --fn '!new URLSearchParams(location.search).has("ranking")'
funnel '16,13,12,11,5,1'
browser select 'select[name=status]' ''
browser select 'select[name=country]' unknown
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 4'
funnel '4,4,4,3,2,0'
browser find label 'Buscar participantes' fill 'Persona 22'
browser press Enter
browser wait --fn 'document.querySelectorAll("button[aria-label^=Review]").length === 1'
funnel '1,1,1,0,0,0'
browser find label 'Buscar participantes' fill 'No matching fixture'
browser press Enter
browser wait --text 'No hay participantes'
funnel '0,0,0,0,0,0'
browser open 'http://127.0.0.1:4321/admin/participants?country=CO&challenge=broken-agent'
funnel '3,3,3,3,2,0'
browser eval 'const country=document.querySelector("select[name=country]");if(country.value!=="CO" || country.selectedOptions[0].textContent!=="Colombia")throw Error("Exact-country selection lost");true'
browser set viewport 390 844
browser eval 'if(document.documentElement.scrollWidth>innerWidth)throw Error("Mobile overflow");true'
browser set viewport 320 740
browser eval 'if(document.documentElement.scrollWidth>innerWidth)throw Error("Narrow viewport overflow");true'
browser open 'http://127.0.0.1:4321/admin/insights?country=outside_peru'
browser eval 'if(document.querySelector("select[name=country]").value!=="outside_peru" || !document.body.innerText.includes("Fuera de Perú"))throw Error("Insights scope lost");true'
browser open 'http://127.0.0.1:4321/admin/insights/history?country=outside_peru'
browser eval 'if(document.querySelector("select[name=country]").value!=="outside_peru" || !document.body.innerText.includes("Fuera de Perú"))throw Error("History scope lost");true'
