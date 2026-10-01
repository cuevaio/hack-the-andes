import { expect, test } from "bun:test";
import type { ParticipantChallengeProgress } from "@chofex/challenges-contract";
import {
  applicationRequirementsFor,
  type RegistrationResult,
  type RegistrationView,
} from "@chofex/registration-contract";

import { nextStepFor } from "../src/participant-guidance.js";

const challenge: ParticipantChallengeProgress = {
  slug: "broken-agent",
  title: "The Scheduler",
  theme: "Broken Agent",
  status: "not_started",
  open: true,
  closed: false,
  playable: true,
  queriesUsed: 0,
  queriesLimit: 0,
  evaluationsUsed: 0,
  evaluationsLimit: 5,
};
const registration: RegistrationView = {
  id: "application-guidance",
  status: "submitted",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  participationMode: "in_person",
  nationalIdProvided: false,
  mediaConsent: false,
  codeOfConductAccepted: true,
  privacyPolicyAccepted: true,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  challenges: [challenge],
};
const resultFor = (
  changes: Partial<RegistrationView> = {},
): RegistrationResult => {
  const current = { ...registration, ...changes };
  return {
    registration: current,
    requirements: applicationRequirementsFor(current),
  };
};
const accepted = resultFor({ status: "accepted" });
const complete: RegistrationResult = {
  ...accepted,
  requirements: { ...accepted.requirements, stage: "complete", missing: [] },
};

const scenarios = [
  {
    name: "submitted without a challenge",
    result: resultFor(),
    command: "andes challenge init --challenge broken-agent",
    repeatRegister: true,
  },
  {
    name: "challenge in progress",
    result: resultFor({
      status: "under_review",
      challenges: [{ ...challenge, status: "in_progress" }],
    }),
    command: "andes challenge show --challenge broken-agent",
    repeatRegister: true,
  },
  {
    name: "evaluated with rank hidden",
    result: resultFor({
      challenges: [{ ...challenge, status: "evaluated", evaluationsUsed: 1 }],
    }),
    command: "andes status",
    repeatRegister: true,
  },
  {
    name: "ranked closed challenge",
    result: resultFor({
      challenges: [
        {
          ...challenge,
          status: "evaluated",
          rank: 3,
          open: false,
          closed: true,
        },
      ],
    }),
    command: "andes status",
    repeatRegister: true,
  },
  {
    name: "accepted before confirmation",
    result: accepted,
    command: "andes confirm",
    repeatRegister: true,
  },
  {
    name: "attendance confirmed",
    result: complete,
    command: "andes badge",
    repeatRegister: true,
  },
  {
    name: "draft",
    result: resultFor({ status: "draft" }),
    command: "andes register",
    repeatRegister: false,
  },
  {
    name: "rejected",
    result: resultFor({
      status: "rejected",
      rejectionReason: "Agrega un proyecto.",
    }),
    command: "andes register",
    repeatRegister: false,
  },
  {
    name: "withdrawn",
    result: resultFor({ status: "withdrawn" }),
    command: "andes register",
    repeatRegister: false,
  },
  {
    name: "challenge closed without evaluation",
    result: resultFor({
      challenges: [{ ...challenge, open: false, closed: true }],
    }),
    command: "andes challenge list",
    repeatRegister: true,
  },
  {
    name: "evaluation budget exhausted without result",
    result: resultFor({
      challenges: [{ ...challenge, status: "in_progress", evaluationsUsed: 5 }],
    }),
    command: "andes challenge list",
    repeatRegister: true,
  },
];

const run = async (apiUrl: string, args: string[]) => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("../src/index.ts", import.meta.url).pathname,
      "--api-url",
      apiUrl,
      "--token",
      "fixture-token",
      ...args,
    ],
    {
      env: { ...process.env, CHOFEX_AUTO_UPDATE: "0" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
};

for (const scenario of scenarios) {
  test(`home, challenge and registration guidance: ${scenario.name}`, async () => {
    const requests: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
        return Response.json({
          version: 1,
          ok: true,
          requestId: "guidance-test",
          data: scenario.result,
        });
      },
    });
    try {
      const commands = [[], ["challenge"], ["status"], ["requirements"]];
      if (scenario.repeatRegister)
        commands.push(["register", "--input", "must-not-read.json"]);
      if (scenario.name === "attendance confirmed") commands.push(["confirm"]);
      for (const args of commands) {
        const human = await run(server.url.toString(), args);
        expect(human.exitCode).toBe(0);
        expect(human.stderr).toBe("");
        expect(human.stdout).toContain(
          `Siguiente comando: ${scenario.command}`,
        );
        const json = await run(server.url.toString(), [
          "--output",
          "json",
          ...args,
        ]);
        expect(json.exitCode).toBe(0);
        expect(json.stderr).toBe("");
        expect(json.stdout.trim().split("\n")).toHaveLength(1);
        expect(JSON.parse(json.stdout)).toMatchObject({
          version: 1,
          ok: true,
          data: { nextStep: { command: scenario.command } },
        });
      }
      expect(new Set(requests)).toEqual(new Set(["GET /api/v1/registration"]));
    } finally {
      server.stop(true);
    }
  }, 30_000);
}

for (const [code, status, command] of [
  ["AUTHENTICATION_REQUIRED", 401, "andes login"],
  ["REGISTRATION_NOT_FOUND", 404, "andes register"],
] as const) {
  test(`home and challenge recover from ${code}`, async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            version: 1,
            ok: false,
            requestId: "guidance-error",
            error: { code, message: "fixture", retryable: false },
          },
          { status },
        );
      },
    });
    try {
      for (const args of [[], ["challenge"]]) {
        const human = await run(server.url.toString(), args);
        expect(human.exitCode).toBe(0);
        expect(human.stdout).toContain(`Siguiente comando: ${command}`);
        const output = await run(server.url.toString(), [
          "--output",
          "json",
          ...args,
        ]);
        expect(output.exitCode).toBe(0);
        expect(output.stderr).toBe("");
        expect(JSON.parse(output.stdout)).toMatchObject({
          ok: true,
          data: { nextStep: { command } },
        });
      }
    } finally {
      server.stop(true);
    }
  });
}

test("JSON validation without input returns an envelope instead of prompting", async () => {
  const result = await run("http://127.0.0.1:1", [
    "--output",
    "json",
    "validate",
  ]);
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim().split("\n")).toHaveLength(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: false,
    error: { code: "INPUT_REQUIRED" },
  });
});

test("an available challenge takes precedence over an exhausted one", () => {
  const result = resultFor({
    challenges: [
      {
        ...challenge,
        slug: "black-box",
        status: "in_progress",
        evaluationsUsed: 5,
      },
      challenge,
    ],
  });
  expect(nextStepFor(result).command).toBe(
    "andes challenge init --challenge broken-agent",
  );
});
