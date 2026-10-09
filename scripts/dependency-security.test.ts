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

test("patched braces preserves ordinary expansion and rejects deep patterns and ASTs", () => {
  check(`
    const assert = require("node:assert/strict");
    const braces = require("braces");
    assert.deepEqual(braces.expand("a/{b,c}"), ["a/b", "a/c"]);
    const deep = "{".repeat(1000) + "a,b" + "}".repeat(1000);
    for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(deep), /nesting exceeds 64/);
    }
    const ast = { type: "root", nodes: [] };
    let node = ast;
    for (let i = 0; i < 1000; i++) {
      const child = { type: "brace", nodes: [], parent: node };
      node.nodes.push(child);
      node = child;
    }
    for (const operation of [braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(ast), /nesting exceeds 64/);
    }
  `);
});
