import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  autoUpdateCli,
  shouldAutoUpdateCli,
  updateChofex,
  upgradeCli,
} from "../src/upgrade.js";

describe("automatic CLI updates", () => {
  test("restarts a standalone command with its original arguments", async () => {
    const directory = await mkdtemp(join(tmpdir(), "andes-restart-"));
    const entry = join(directory, "entry.ts");
    const executable = join(directory, "andes");
    const upgradeModule = fileURLToPath(
      new URL("../src/upgrade.ts", import.meta.url),
    );
    const metadataModule = fileURLToPath(
      new URL("../src/metadata.ts", import.meta.url),
    );
    try {
      await writeFile(
        entry,
        `
import { runUpdatedCli, isStandaloneExecutable } from ${JSON.stringify(upgradeModule)};
import { cliCommandName } from ${JSON.stringify(metadataModule)};
if (process.env.CHOFEX_AUTO_UPDATE === "0") {
  process.stdout.write(JSON.stringify({ command: cliCommandName, standalone: isStandaloneExecutable(), arguments: process.argv.slice(2) }));
} else {
  process.exitCode = await runUpdatedCli();
}
`,
      );
      execFileSync(process.execPath, [
        "build",
        entry,
        "--compile",
        '--define=CHOFEX_VERSION="0.1.999"',
        `--outfile=${executable}`,
      ]);
      const output = execFileSync(executable, ["--output", "json", "status"], {
        encoding: "utf8",
        env: { ...process.env, CHOFEX_AUTO_UPDATE: "1" },
      });
      expect(JSON.parse(output)).toEqual({
        command: "andes",
        standalone: true,
        arguments: ["--output", "json", "status"],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("installs a newer version published to npm", async () => {
    const upgrades: string[] = [];

    const result = await autoUpdateCli("0.1.146", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade: async (version) => {
        upgrades.push(version);
      },
    });

    expect(upgrades).toEqual(["0.1.147"]);
    expect(result).toEqual({
      status: "updated",
      previousVersion: "0.1.146",
      version: "0.1.147",
    });
  });

  test("does not reinstall the current or an older npm version", async () => {
    let upgradeCount = 0;
    const upgrade = async (_version: string) => {
      upgradeCount += 1;
    };

    const current = await autoUpdateCli("0.1.147", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade,
    });
    const ahead = await autoUpdateCli("0.2.0", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade,
    });

    expect(upgradeCount).toBe(0);
    expect(current.status).toBe("current");
    expect(ahead.status).toBe("current");
  });

  test("treats stable releases as newer than prereleases", async () => {
    let upgraded = false;

    await autoUpdateCli("1.0.0-rc.2", {
      fetchLatestVersion: async () => "1.0.0",
      upgrade: async (_version) => {
        upgraded = true;
      },
    });

    expect(upgraded).toBe(true);
  });

  test("only runs automatically for global npm or standalone CLIs", async () => {
    const sourceEntry = join("workspace", "apps", "cli", "src", "index.ts");
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");
    const installedEntry = join(
      globalNodeModulesPath,
      "chofex-cli",
      "dist",
      "index.js",
    );
    const localEntry = join(
      "workspace",
      "node_modules",
      "chofex-cli",
      "dist",
      "index.js",
    );

    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: installedEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: localEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: true,
      }),
    ).toBe(true);
  });

  test("supports opt-out and avoids duplicate explicit updates", async () => {
    const installedEntry = join(
      "node_modules",
      "chofex-cli",
      "dist",
      "index.js",
    );
    const options = {
      entryPath: installedEntry,
      standalone: false,
    };

    expect(
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["status"],
        environmentValue: "0",
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["update"],
        environmentValue: undefined,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["upgrade"],
        environmentValue: undefined,
      }),
    ).toBe(false);
  });

  test("does not mistake an option value for the update command", async () => {
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");

    expect(
      await shouldAutoUpdateCli({
        arguments: ["validate", "--input", "update"],
        entryPath: join(
          globalNodeModulesPath,
          "chofex-cli",
          "dist",
          "index.js",
        ),
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["--token", "update", "status"],
        entryPath: join(
          globalNodeModulesPath,
          "chofex-cli",
          "dist",
          "index.js",
        ),
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
  });

  test("recognizes the package inside npm's reported global root", async () => {
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");
    const npmCalls: Array<ReadonlyArray<string>> = [];

    const enabled = await shouldAutoUpdateCli({
      arguments: ["status"],
      entryPath: join(globalNodeModulesPath, "chofex-cli", "dist", "index.js"),
      environmentValue: undefined,
      npmRunner: async (arguments_) => {
        npmCalls.push(arguments_);
        return {
          exitCode: 0,
          stdout: globalNodeModulesPath,
          stderr: "",
        };
      },
      standalone: false,
    });

    expect(enabled).toBe(true);
    expect(npmCalls).toEqual([["root", "--global"]]);
  });
});

describe("CLI upgrade", () => {
  test("updates the CLI and globally refreshes the agent skill", async () => {
    const npmCalls: Array<ReadonlyArray<string>> = [];
    const skillCalls: Array<ReadonlyArray<string>> = [];

    await updateChofex({
      npmRunner: async (arguments_) => {
        npmCalls.push(arguments_);
        return { exitCode: 0, stderr: "" };
      },
      skillRunner: async (arguments_) => {
        skillCalls.push(arguments_);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(npmCalls).toHaveLength(1);
    expect(skillCalls).toEqual([
      [
        "--yes",
        "skills",
        "add",
        "https://github.com/crafter-station/hack-the-andes",
        "--skill",
        "chofex-hackathon",
        "-g",
        "-y",
      ],
    ]);
  });

  test("does not update the skill when the CLI update fails", async () => {
    let skillUpdateCount = 0;

    await expect(
      updateChofex({
        npmRunner: async () => ({ exitCode: 1, stderr: "permission denied" }),
        skillRunner: async () => {
          skillUpdateCount += 1;
          return { exitCode: 0, stderr: "" };
        },
      }),
    ).rejects.toThrow("npm terminó con código 1: permission denied");
    expect(skillUpdateCount).toBe(0);
  });

  test("reports skill update failures after updating the CLI", async () => {
    await expect(
      updateChofex({
        npmRunner: async () => ({ exitCode: 0, stderr: "" }),
        skillRunner: async () => ({
          exitCode: 1,
          stderr: "skill install failed",
        }),
      }),
    ).rejects.toThrow(
      "instalador de skills terminó con código 1: skill install failed",
    );
  });

  test("forces npm to refresh the latest package", async () => {
    const calls: Array<ReadonlyArray<string>> = [];
    let cacheDirectory = "";

    await upgradeCli({
      npmRunner: async (arguments_) => {
        calls.push(arguments_);
        cacheDirectory = (arguments_[5] ?? "").replace("--cache=", "");
        expect((await stat(cacheDirectory)).isDirectory()).toBe(true);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(calls).toEqual([
      [
        "install",
        "--global",
        "chofex-cli@latest",
        "--force",
        "--prefer-online",
        `--cache=${cacheDirectory}`,
      ],
    ]);
    expect(stat(cacheDirectory)).rejects.toThrow();
  });

  test("reports npm failures", async () => {
    expect(
      upgradeCli({
        npmRunner: async () => ({
          exitCode: 1,
          stderr: "permission denied",
        }),
      }),
    ).rejects.toThrow("npm terminó con código 1: permission denied");
  });

  test("installs the exact npm version requested by the startup check", async () => {
    const calls: Array<ReadonlyArray<string>> = [];

    await upgradeCli({
      version: "0.1.147",
      npmRunner: async (arguments_) => {
        calls.push(arguments_);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(calls[0]?.[2]).toBe("chofex-cli@0.1.147");
  });

  test("uses the curl installer for a standalone executable", async () => {
    const installs: Array<{ directory: string; version: string }> = [];

    await upgradeCli({
      standalone: true,
      version: "0.1.147",
      installerRunner: async (installDirectory, version) => {
        installs.push({ directory: installDirectory, version });
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(installs).toEqual([
      { directory: dirname(process.execPath), version: "0.1.147" },
    ]);
  });
});
