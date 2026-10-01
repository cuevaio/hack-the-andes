#!/usr/bin/env bash
set -euo pipefail

# Start preview-participant-history.tsx in another terminal before this check.
browser() { bunx agent-browser --session participant-history-check "$@"; }
trap 'browser close >/dev/null' EXIT
browser --args --no-sandbox open http://127.0.0.1:4321/admin/insights/history
browser fill 'input[name=showUp]' 80
browser fill 'input[name=cost]' 20
browser find role button click --name 'Calcular escenario'
browser wait --fn 'new URLSearchParams(location.search).get("showUp") === "80" && document.querySelector("#goal-progress")?.value === 4'
browser eval 'const text=document.querySelector("[aria-labelledby=attendance-goal]").innerText; if(!text.includes("125 confirmaciones") || !text.includes("120") || !text.includes("2,400") || !text.includes("supera los 100 cupos")) throw Error("Wrong attendance scenario"); true'
browser select 'select[name=country]' PE
browser select 'select[name=days]' 7
browser eval 'const input=document.querySelector("input[type=date]");input.value="2026-09-24";input.dispatchEvent(new Event("change",{bubbles:true}));true'
browser find role button click --name 'Ver evolución'
browser wait --fn 'new URLSearchParams(location.search).get("end") === "2026-09-24"'
browser eval 'const q=new URLSearchParams(location.search);if(document.querySelector("#goal-progress").value!==4 || q.get("showUp")!=="80" || q.get("cost")!=="20" || q.get("end")!=="2026-09-24") throw Error("Filters changed global goal or lost assumptions");true'
browser find text 'Ver tabla diaria con los valores exactos' click
browser eval 'const rows=[...document.querySelectorAll("tbody tr")];for(const row of rows){const counts=[...row.querySelectorAll("td")].map(cell=>Number(cell.textContent));if(counts[0]!==counts.slice(1).reduce((a,b)=>a+b,0))throw Error("Stage conservation failed");}const actual=[...rows.at(-1).children].map(cell=>cell.textContent);const expected=["2026-09-24","17","1","2","2","1","4","3","0","1","0","3"];if(rows.length!==7 || JSON.stringify(actual)!==JSON.stringify(expected))throw Error("Wrong selected-day counts");true'
browser set viewport 390 844
browser focus '[aria-label="Tabla diaria de etapas, desplazable"]'
browser press ArrowRight
browser wait --fn 'document.querySelector("[aria-label=\"Tabla diaria de etapas, desplazable\"]").scrollLeft > 0'
browser eval 'const table=document.querySelector("[aria-label=\"Tabla diaria de etapas, desplazable\"]");if(table.scrollLeft<=0 || document.documentElement.scrollWidth>innerWidth)throw Error("Mobile keyboard scrolling failed");true'
browser set viewport 320 740
browser eval 'if(document.documentElement.scrollWidth>innerWidth)throw Error("Narrow viewport overflow");true'
browser select 'select[name=challenge]' broken-agent
browser find role button click --name 'Ver evolución'
browser wait --fn 'new URLSearchParams(location.search).get("challenge") === "broken-agent"'
browser eval 'const q=new URLSearchParams(location.search);if(q.get("challenge")!=="broken-agent" || document.querySelector("#goal-progress").value!==4)throw Error("Challenge scope changed the goal");true'
browser back
browser wait --fn 'new URLSearchParams(location.search).get("challenge") !== "broken-agent"'
browser eval 'if(!document.querySelector("[aria-labelledby=history-title]").innerText.includes("Perú · Todas las personas") || new URLSearchParams(location.search).get("end")!=="2026-09-24")throw Error("Back navigation lost historical scope");true'
