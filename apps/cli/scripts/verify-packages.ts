import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import metadata from "../package.json" with { type: "json" };

const packagesDirectory = fileURLToPath(
  new URL("../dist/npm/", import.meta.url),
);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "chofex-packages-"));
const env = { ...process.env, CHOFEX_AUTO_UPDATE: "0", NO_COLOR: "1" };

try {
  for (const name of ["chofex-cli", "hacktheandes-cli"]) {
    execFileSync("npm", ["pack", "--pack-destination", temporaryDirectory], {
      cwd: join(packagesDirectory, name),
      env,
      stdio: "pipe",
    });
    const directory = join(temporaryDirectory, name);
    await mkdir(directory);
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        directory,
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        join(temporaryDirectory, `${name}-${metadata.version}.tgz`),
      ],
      { cwd: directory, env, stdio: "pipe" },
    );

    for (const command of ["andes", "chofex"]) {
      const executable = join(directory, "node_modules/.bin", command);
      const run = (...args: string[]) =>
        execFileSync(executable, args, {
          cwd: directory,
          env,
          encoding: "utf8",
        });
      assert.equal(run("--version").trim(), `${command} v${metadata.version}`);
      assert.match(
        run("register", "--help"),
        new RegExp(`${command} register`),
      );
      assert.match(run("challenge", "--help"), /ranking/);
      const output = run(
        "--output",
        "json",
        "schema",
        "--stage",
        "application",
      );
      assert.equal(output.trim().split("\n").length, 1);
      const schema = JSON.parse(output);
      assert.equal(schema.fullName, "Ada Lovelace");
      assert.equal(schema.codeOfConductAccepted, true);
      const version = JSON.parse(run("--output", "json", "--version"));
      assert.equal(version.version, 1);
      assert.equal(version.ok, true);
      assert.equal(version.data.cliVersion, metadata.version);

      const toolsDirectory = join(directory, `tools-${command}`);
      await mkdir(toolsDirectory);
      const upgradeArgumentsPath = join(toolsDirectory, "upgrade.json");
      await writeFile(
        join(toolsDirectory, "npm"),
        `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(upgradeArgumentsPath)}, JSON.stringify(process.argv.slice(2)));\n`,
        { mode: 0o755 },
      );
      await writeFile(join(toolsDirectory, "npx"), "#!/usr/bin/env node\n", {
        mode: 0o755,
      });
      const updated = execFileSync(executable, ["--output", "json", "update"], {
        cwd: directory,
        env: {
          ...env,
          PATH: `${toolsDirectory}${delimiter}${process.env.PATH}`,
        },
        encoding: "utf8",
      });
      assert.equal(JSON.parse(updated).ok, true);
      const upgradeArguments = JSON.parse(
        await readFile(upgradeArgumentsPath, "utf8"),
      );
      assert.deepEqual(upgradeArguments.slice(0, 3), [
        "install",
        "--global",
        `${name}@latest`,
      ]);
      process.stdout.write(`${name}: ${command} passed\n`);
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
