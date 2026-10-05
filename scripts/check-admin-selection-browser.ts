import assert from "node:assert/strict";

const origin = "http://127.0.0.1:4186";
async function browser(...args: string[]) {
  const child = Bun.spawn(["agent-browser", ...args], {
    env: { ...process.env, AGENT_BROWSER_SESSION: "admin-selection-check" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  assert.equal(code, 0, `${args.join(" ")}\n${stderr}\n${stdout}`);
  return stdout;
}
async function check(expression: string) {
  await browser("wait", "--fn", expression);
  const output = await browser(
    "eval",
    "-b",
    Buffer.from(expression).toString("base64"),
  );
  assert.equal(output.trim(), "true", `${expression}\n${output}`);
}
async function click(role: string, name: string) {
  await browser("find", "role", role, "click", "--name", name);
}
async function wait(text: string) {
  await browser("wait", "--text", text);
}
async function currentStatus(name: string) {
  const response = await fetch(
    `${origin}/api/admin/applications?view=ranking&ranking=black-box&q=${encodeURIComponent(name)}`,
  );
  const result = await response.json();
  return result.data.candidates.find(
    (candidate: { name: string; status: string }) => candidate.name === name,
  )?.status;
}

try {
  await browser(
    "--args",
    "--no-sandbox",
    "--allowed-domains",
    "127.0.0.1",
    "open",
    `${origin}/admin/participants`,
  );
  await check("document.title.startsWith('Prueba de selecci')");
  await wait("Sin resultado");
  await click("link", "RANKINGS");
  await wait("Rankings de selección");
  await check(
    "location.search.includes('view=ranking') && !document.body.innerText.includes('Sin resultado') && document.body.innerText.includes('24 participantes en el ranking global')",
  );
  assert.equal(await currentStatus("Persona 2"), "submitted");
  await click("button", "Aprobar a Persona 2");
  await wait("CONFIRMAR APROBACIÓN");
  assert.equal(await currentStatus("Persona 2"), "submitted");
  await click("button", "CONFIRMAR APROBACIÓN");
  await wait(
    "Decisión guardada. El correo se enviará cuando el carnet esté listo.",
  );
  assert.equal(await currentStatus("Persona 2"), "accepted");
  await check("document.body.innerText.includes('Posición global #1')");
  await click("button", "Cerrar detalles del participante");
  await click("button", "Rechazar a Persona 3");
  await click("checkbox", "Notificar el rechazo por correo");
  await click("button", "CONFIRMAR RECHAZO");
  await wait("Decisión guardada sin enviar un correo.");
  assert.equal(await currentStatus("Persona 3"), "rejected");
  await click("button", "Cerrar detalles del participante");
  await click("link", "3");
  await wait("Persona 24");
  await check(
    "document.body.innerText.includes('#21') && document.body.innerText.includes('#24') && !document.querySelector('[aria-label=\"Aprobar a Persona 24\"]')",
  );
  await browser("select", "select[name=country]", "PE");
  await wait("Persona 1");
  await check(
    "document.body.innerText.includes('#3') && !document.querySelector('[aria-label=\"Ver detalles de Persona 2\"]')",
  );
  await click("link", "2");
  await wait("Persona 21");
  await check(
    "document.body.innerText.includes('#21') && document.body.innerText.includes('#23')",
  );
  await browser("select", "select[name=ranking]", "broken-agent");
  await wait("Persona 23");
  await check(
    "location.search.includes('ranking=broken-agent') && document.body.innerText.includes('88.00%') && !document.body.innerText.includes('90.00%')",
  );
  await browser("select", "select[name=ranking]", "make-it-fast");
  await wait("No hay participantes con estos filtros");
  await check(
    "document.body.innerText.includes('0 participantes en el ranking global')",
  );
  await browser("select", "select[name=ranking]", "black-box");
  await wait("Persona 1");
  await click("button", "LIMPIAR FILTROS");
  await wait("Persona 2");
  await check(
    "location.search.includes('view=ranking') && !location.search.includes('country=')",
  );
  await click("button", "Aprobar a Persona 10");
  await click("button", "Next candidate (J or right arrow)");
  await wait("Persona 11");
  await check(
    "!document.body.innerText.includes('CONFIRMAR APROBACIÓN') && document.body.innerText.includes('APROBAR')",
  );
  await click("button", "Cerrar detalles del participante");
  await fetch(`${origin}/fixture/ranking-error?enabled=true`, {
    method: "POST",
  });
  await browser("select", "select[name=ranking]", "broken-agent");
  await wait("Fallo de ranking de prueba");
  await check(
    "!document.querySelector('[aria-label^=\"Ver detalles de\"]') && !document.body.innerText.includes('Puntaje')",
  );
  await fetch(`${origin}/fixture/ranking-error?enabled=false`, {
    method: "POST",
  });
  await click("button", "ACTUALIZAR");
  await wait("Persona 24");
  await check("document.body.innerText.includes('89.00%')");
  await browser("select", "select[name=ranking]", "black-box");
  await wait("Persona 1");
  await fetch(`${origin}/fixture/ranking-error?delay=1500`, { method: "POST" });
  await browser("fill", "#candidate-search", "Persona 4");
  await browser("press", "Enter");
  await check(
    "document.body.innerText.includes('Actualizando resultados') && !document.querySelector('[aria-label^=\"Ver detalles de\"]')",
  );
  await wait("Persona 4");
  await fetch(`${origin}/fixture/ranking-error`, { method: "POST" });
  await click("button", "LIMPIAR FILTROS");
  await wait("Persona 1");
  await browser("set", "viewport", "1440", "1000");
  await browser("scroll", "up", "3000");
  await browser("screenshot", "/tmp/opencode/admin-rankings-desktop.png");
  await browser("set", "viewport", "390", "844");
  await browser("scroll", "down", "400");
  await check("document.documentElement.scrollWidth <= innerWidth");
  await browser("screenshot", "/tmp/opencode/admin-rankings-mobile.png");
  await click("link", "PARTICIPANTES");
  await wait("Sin resultado");
  await browser("fill", "#candidate-search", "Persona 2");
  await browser("press", "Enter");
  await wait("Persona 2");
  await click("button", "Review Persona 2");
  await check("document.body.innerText.includes('APROBADOS')");
  await click("button", "Cerrar detalles del participante");
  await browser("eval", "history.back()");
  await wait("Sin resultado");
  await browser("eval", "history.back()");
  await wait("Rankings de selección");
  await check("location.search.includes('view=ranking')");
  console.log(
    "Admin selection browser checks passed. Approval, rejection, exact ranks, filters, cross-page review, distinct challenges, failed/delayed requests, view switching, history and mobile layout verified against isolated PGlite data.",
  );
} finally {
  await browser("close");
}
