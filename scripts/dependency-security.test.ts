import { expect, test } from "bun:test";

const check = (source: string) => {
  const result = Bun.spawnSync(["node", "-e", source], {
    cwd: new URL("..", import.meta.url).pathname,
  });
  expect({ code: result.exitCode, stderr: result.stderr.toString() }).toEqual({
    code: 0,
    stderr: "",
  });
};

test("Trigger CLI starts under Node with the maintained expansion package", () => {
  const entry = new URL(
    "../node_modules/trigger.dev/dist/esm/index.js",
    import.meta.url,
  ).pathname;
  const result = Bun.spawnSync(["node", entry, "--help"]);
  expect({ code: result.exitCode, stderr: result.stderr.toString() }).toEqual({
    code: 0,
    stderr: "",
  });
  expect(result.stdout.toString()).toContain("deploy");
});

test("maintained brace expansion preserves watcher patterns and bounds hostile inputs", () => {
  check(`
    const assert = require("node:assert/strict");
    const braces = require("braces");
    assert.equal(require("braces/package.json").name, "brace-expansion");
    assert.deepEqual(braces.expand("a/{b,c}"), ["a/b", "a/c"]);
    assert.deepEqual(braces.expand("file-{1..3}.js"), ["file-1.js", "file-2.js", "file-3.js"]);
    for (const pattern of ["{".repeat(2000) + "a,b" + "}".repeat(2000), "{a,b}".repeat(3000), "{1..1000000000}"]) {
      const results = braces.expand(pattern);
      assert.ok(results.length <= 100000);
      assert.ok(results.reduce((total, value) => total + value.length, 0) <= 4000000);
    }
  `);
});

test("Trigger's real file watcher still handles brace patterns", () => {
  check(`
    const assert = require("node:assert/strict");
    const fs = require("node:fs");
    const path = require("node:path");
    const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "andes-watcher-"));
    for (const name of ["first.js", "second.ts", "ignored.txt"]) fs.writeFileSync(path.join(directory, name), "");
    const watcher = require("chokidar").watch(path.join(directory, "*.{js,ts}"), { ignoreInitial: true });
    const timeout = setTimeout(() => { console.error("Watcher did not become ready"); process.exit(1); }, 3000);
    watcher.once("error", (error) => { throw error; });
    watcher.once("ready", async () => {
      try {
        const names = Object.values(watcher.getWatched()).flat();
        assert.ok(names.includes("first.js"));
        assert.ok(names.includes("second.ts"));
        assert.ok(!names.includes("ignored.txt"));
      } finally {
        clearTimeout(timeout);
        await watcher.close();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  `);
});
