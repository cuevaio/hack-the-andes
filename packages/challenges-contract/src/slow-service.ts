import {
  acceptedLegEditLimit,
  activeJournalLimit,
  type LedgerOperation,
  type LedgerResult,
  type LedgerSetup,
  timestampLimit,
} from "@chofex/challenges-contract/slow-service/contract";
import { slowServiceToolkit } from "@chofex/challenges-contract/slow-service/toolkit";

export type {
  Amendment,
  AmendmentResult,
  BalanceReport,
  JournalEntry,
  Ledger,
  LedgerOperation,
  LedgerResult,
  LedgerSetup,
  ReportRequest,
} from "@chofex/challenges-contract/slow-service/contract";

export const slowServiceChallengeSlug = "make-it-fast";
export const slowServiceChallengeVersion = "slow-service-v3";
export const slowServiceScaffoldDirectory = "slow-service";
export const slowServiceSolutionPath = "slow-service/ledger.js";
export const slowServiceSourceLimit = 32_768;
export const slowServiceTimestampLimit = timestampLimit;
export const slowServiceMemoryLimit = 640 * 1_024 * 1_024;
export const slowServiceStackLimit = 512 * 1_024;
export const slowServiceOperationLimit = 100_000;
export const slowServiceAcceptedLegEditLimit = acceptedLegEditLimit;
export const slowServiceActiveJournalLimit = activeJournalLimit;
// Calibrated display policy for the released v3 engine.
export const slowServicePublicPerformance = {
  kind: "calibrated",
  smallJournalCount: 6_000,
  largeJournalCount: 24_000,
  phaseOperations: 1_024,
  tiers: [
    { points: 10, normalizedGrowth: 1.8, relativeCpu: 3 },
    { points: 6, normalizedGrowth: 3.5, relativeCpu: 6 },
    { points: 3, normalizedGrowth: 6, relativeCpu: 12 },
  ],
} as const;
export const isSlowServiceSourceWithinLimit = (source: string): boolean =>
  source.length > 0 &&
  new TextEncoder().encode(source).byteLength <= slowServiceSourceLimit;

export const slowServiceStarterSource =
  slowServiceToolkit.kind === "ready"
    ? slowServiceToolkit.files["ledger.js"]
    : undefined;
export const slowServiceReadme =
  slowServiceToolkit.kind === "ready"
    ? slowServiceToolkit.files["README.md"]
    : undefined;

export interface LedgerPublicScenario {
  readonly name: string;
  readonly setup: LedgerSetup;
  readonly operations: ReadonlyArray<LedgerOperation>;
  readonly expected: ReadonlyArray<LedgerResult>;
}

// This boundary describes only what the public suite consumes. The ready parent
// runner may return additional trusted CPU and peak-RSS diagnostics.
export type LedgerPublicRunner = (input: {
  readonly source: string;
  readonly setup: LedgerSetup;
  readonly operations: ReadonlyArray<LedgerOperation>;
  readonly checkpointBudget: number;
}) => Promise<
  | {
      readonly kind: "completed";
      readonly results: ReadonlyArray<LedgerResult>;
    }
  | {
      readonly kind: "failed";
      readonly reason: "budget" | "execution" | "timeout" | "memory";
    }
>;

export const slowServicePublicScenarios: ReadonlyArray<LedgerPublicScenario> = [
  {
    name: "setup, checkpoint cero e intervalos vacíos",
    setup: {
      accounts: [
        { id: "caja", opening: 1_000 },
        { id: "tienda", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "report",
        report: {
          account: "caja",
          from: 0,
          to: timestampLimit,
          asOf: 0,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 10,
          to: 10,
          asOf: 0,
          percentile: 50,
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "pago",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 10,
          to: 10,
          asOf: 1,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 11,
          to: 11,
          asOf: 1,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: { account: "tienda", from: 0, to: 10, asOf: 1, percentile: 50 },
      },
    ],
    expected: [
      {
        opening: 1_000,
        net: 0,
        closing: 1_000,
        entries: 0,
        minimumBalance: 1_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "committed", revision: 1, checkpoint: 1 },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 300,
        net: 0,
        closing: 300,
        entries: 0,
        minimumBalance: 300,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
    ],
  },
  {
    name: "revisiones optimistas, anulaciones y reintentos",
    setup: {
      accounts: [
        { id: "a", opening: 100 },
        { id: "b", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: { id: "ausente", expectedRevision: 0, entry: null },
      },
      {
        kind: "amend",
        amendment: { id: "ausente", expectedRevision: 0, entry: null },
      },
      {
        kind: "amend",
        amendment: { id: "ausente", expectedRevision: 1, entry: null },
      },
      {
        kind: "amend",
        amendment: {
          id: "pago",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "a", delta: -30 },
              { account: "b", delta: 30 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: { id: "pago", expectedRevision: 0, entry: null },
      },
      {
        kind: "amend",
        amendment: {
          id: "pago",
          expectedRevision: 1,
          entry: {
            at: 10,
            legs: [
              { account: "a", delta: -30 },
              { account: "b", delta: 30 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: { id: "pago", expectedRevision: 2, entry: null },
      },
      {
        kind: "report",
        report: { account: "b", from: 0, to: 20, asOf: 4, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "b", from: 0, to: 20, asOf: 5, percentile: 50 },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "conflict", revision: 1 },
      { kind: "committed", revision: 2, checkpoint: 2 },
      { kind: "committed", revision: 1, checkpoint: 3 },
      { kind: "conflict", revision: 1 },
      { kind: "committed", revision: 2, checkpoint: 4 },
      { kind: "committed", revision: 3, checkpoint: 5 },
      {
        opening: 0,
        net: 30,
        closing: 30,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
    ],
  },
  {
    name: "solvencia retroactiva y rollback de todas las cuentas",
    setup: {
      accounts: [
        { id: "caja", opening: 1_000 },
        { id: "tienda", opening: 0 },
        { id: "impuesto", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "venta",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "reparto",
          expectedRevision: 0,
          entry: {
            at: 20,
            legs: [
              { account: "tienda", delta: -120 },
              { account: "impuesto", delta: 120 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "venta",
          expectedRevision: 1,
          entry: {
            at: 30,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "tienda", from: 0, to: 40, asOf: 2, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 40, asOf: 2, percentile: 50 },
      },
      {
        kind: "report",
        report: {
          account: "impuesto",
          from: 0,
          to: 40,
          asOf: 2,
          percentile: 50,
        },
      },
      {
        kind: "amend",
        amendment: { id: "venta", expectedRevision: 1, entry: null },
      },
      {
        kind: "amend",
        amendment: {
          id: "rescate",
          expectedRevision: 0,
          entry: {
            at: 5,
            legs: [
              { account: "caja", delta: -120 },
              { account: "tienda", delta: 120 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "venta",
          expectedRevision: 1,
          entry: {
            at: 30,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 15,
          to: 25,
          asOf: 4,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 15,
          to: 25,
          asOf: 2,
          percentile: 50,
        },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "committed", revision: 1, checkpoint: 2 },
      { kind: "insolvent", account: "tienda", at: 20, balance: -120 },
      {
        opening: 0,
        net: 180,
        closing: 180,
        entries: 2,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 120,
      },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 1,
        minimumBalance: 700,
        debits: 1,
        debitAmountAtPercentile: 300,
      },
      {
        opening: 0,
        net: 120,
        closing: 120,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "insolvent", account: "tienda", at: 20, balance: -120 },
      { kind: "committed", revision: 1, checkpoint: 3 },
      { kind: "committed", revision: 2, checkpoint: 4 },
      {
        opening: 120,
        net: -120,
        closing: 0,
        entries: 1,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 120,
      },
      {
        opening: 300,
        net: -120,
        closing: 180,
        entries: 1,
        minimumBalance: 180,
        debits: 1,
        debitAmountAtPercentile: 120,
      },
    ],
  },
  {
    name: "reemplazo completo y grupos simultáneos de timestamp",
    setup: {
      accounts: [
        { id: "a", opening: 100 },
        { id: "b", opening: 0 },
        { id: "c", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "uno",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "a", delta: -100 },
              { account: "b", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "dos",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "b", delta: -100 },
              { account: "a", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "b", from: 10, to: 11, asOf: 2, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: {
          id: "uno",
          expectedRevision: 1,
          entry: {
            at: 10,
            legs: [
              { account: "a", delta: -100 },
              { account: "b", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "dos",
          expectedRevision: 1,
          entry: {
            at: 10,
            legs: [
              { account: "b", delta: -60 },
              { account: "a", delta: 40 },
              { account: "c", delta: 20 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "b", from: 10, to: 11, asOf: 4, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "c", from: 10, to: 11, asOf: 4, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "b", from: 10, to: 11, asOf: 2, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: { id: "dos", expectedRevision: 2, entry: null },
      },
      {
        kind: "report",
        report: { account: "b", from: 10, to: 11, asOf: 5, percentile: 50 },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "committed", revision: 1, checkpoint: 2 },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 2,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 100,
      },
      { kind: "committed", revision: 2, checkpoint: 3 },
      { kind: "committed", revision: 2, checkpoint: 4 },
      {
        opening: 0,
        net: 40,
        closing: 40,
        entries: 2,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 60,
      },
      {
        opening: 0,
        net: 20,
        closing: 20,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 2,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 100,
      },
      { kind: "committed", revision: 3, checkpoint: 5 },
      {
        opening: 0,
        net: 100,
        closing: 100,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
    ],
  },
  {
    name: "diagnóstico por orden de setup y primer saldo negativo",
    setup: {
      accounts: [
        { id: "z", opening: 10 },
        { id: "a", opening: 0 },
        { id: "reserva", opening: 100 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "financia",
          expectedRevision: 0,
          entry: {
            at: 0,
            legs: [
              { account: "reserva", delta: -40 },
              { account: "z", delta: 20 },
              { account: "a", delta: 20 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "temprano",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "a", delta: -15 },
              { account: "reserva", delta: 15 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "tarde",
          expectedRevision: 0,
          entry: {
            at: 20,
            legs: [
              { account: "z", delta: -25 },
              { account: "reserva", delta: 25 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: { id: "financia", expectedRevision: 1, entry: null },
      },
      {
        kind: "amend",
        amendment: { id: "financia", expectedRevision: 0, entry: null },
      },
      {
        kind: "report",
        report: {
          account: "reserva",
          from: 0,
          to: 30,
          asOf: 3,
          percentile: 50,
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "rechazado",
          expectedRevision: 0,
          entry: {
            at: 5,
            legs: [
              { account: "z", delta: -40 },
              { account: "reserva", delta: 40 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: { id: "rechazado", expectedRevision: 0, entry: null },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "committed", revision: 1, checkpoint: 2 },
      { kind: "committed", revision: 1, checkpoint: 3 },
      { kind: "insolvent", account: "z", at: 20, balance: -15 },
      { kind: "conflict", revision: 1 },
      {
        opening: 100,
        net: 0,
        closing: 100,
        entries: 3,
        minimumBalance: 60,
        debits: 1,
        debitAmountAtPercentile: 40,
      },
      { kind: "insolvent", account: "z", at: 5, balance: -10 },
      { kind: "committed", revision: 1, checkpoint: 4 },
    ],
  },
  {
    name: "historia inmutable, IDs opacos y extremos numéricos",
    setup: {
      accounts: [
        { id: "__proto__", opening: 1_000_000_000_000 },
        { id: " Perú ", opening: 0 },
        { id: "constructor", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "constructor",
          expectedRevision: 0,
          entry: {
            at: 2_147_483_647,
            legs: [
              { account: "__proto__", delta: -1_000_000_000 },
              { account: " Perú ", delta: 1_000_000_000 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: {
          account: " Perú ",
          from: 2_147_483_647,
          to: timestampLimit,
          asOf: 1,
          percentile: 50,
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "constructor",
          expectedRevision: 1,
          entry: {
            at: 0,
            legs: [
              { account: "__proto__", delta: -500_000_000 },
              { account: "constructor", delta: 500_000_000 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: {
          account: " Perú ",
          from: 2_147_483_647,
          to: timestampLimit,
          asOf: 1,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: " Perú ",
          from: 0,
          to: timestampLimit,
          asOf: 2,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "constructor",
          from: 1,
          to: timestampLimit,
          asOf: 2,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "__proto__",
          from: 0,
          to: timestampLimit,
          asOf: 0,
          percentile: 50,
        },
      },
      {
        kind: "amend",
        amendment: { id: "constructor", expectedRevision: 2, entry: null },
      },
      {
        kind: "report",
        report: {
          account: "constructor",
          from: 0,
          to: timestampLimit,
          asOf: 2,
          percentile: 50,
        },
      },
      {
        kind: "report",
        report: {
          account: "constructor",
          from: 0,
          to: timestampLimit,
          asOf: 3,
          percentile: 50,
        },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      {
        opening: 0,
        net: 1_000_000_000,
        closing: 1_000_000_000,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "committed", revision: 2, checkpoint: 2 },
      {
        opening: 0,
        net: 1_000_000_000,
        closing: 1_000_000_000,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 500_000_000,
        net: 0,
        closing: 500_000_000,
        entries: 0,
        minimumBalance: 500_000_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 1_000_000_000_000,
        net: 0,
        closing: 1_000_000_000_000,
        entries: 0,
        minimumBalance: 1_000_000_000_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "committed", revision: 3, checkpoint: 3 },
      {
        opening: 0,
        net: 500_000_000,
        closing: 500_000_000,
        entries: 1,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 0,
        net: 0,
        closing: 0,
        entries: 0,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
    ],
  },
  {
    name: "percentiles exactos, multiplicidad y créditos excluidos",
    setup: {
      accounts: [
        { id: "caja", opening: 1_000 },
        { id: "tienda", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "cien",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -100 },
              { account: "tienda", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "trescientos",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: {
          account: "tienda",
          from: 10,
          to: 11,
          asOf: 2,
          percentile: 100,
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "credito",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: 200 },
              { account: "tienda", delta: -200 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 3, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 3, percentile: 51 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 3, percentile: 100 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 3, percentile: 1 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 11, to: 11, asOf: 3, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: {
          id: "otro-cien",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -100 },
              { account: "tienda", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 4, percentile: 66 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 10, to: 11, asOf: 4, percentile: 67 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 10, asOf: 4, percentile: 100 },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "committed", revision: 1, checkpoint: 2 },
      {
        opening: 0,
        net: 400,
        closing: 400,
        entries: 2,
        minimumBalance: 0,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "committed", revision: 1, checkpoint: 3 },
      {
        opening: 1_000,
        net: -200,
        closing: 800,
        entries: 3,
        minimumBalance: 800,
        debits: 2,
        debitAmountAtPercentile: 100,
      },
      {
        opening: 1_000,
        net: -200,
        closing: 800,
        entries: 3,
        minimumBalance: 800,
        debits: 2,
        debitAmountAtPercentile: 300,
      },
      {
        opening: 1_000,
        net: -200,
        closing: 800,
        entries: 3,
        minimumBalance: 800,
        debits: 2,
        debitAmountAtPercentile: 300,
      },
      {
        opening: 1_000,
        net: -200,
        closing: 800,
        entries: 3,
        minimumBalance: 800,
        debits: 2,
        debitAmountAtPercentile: 100,
      },
      {
        opening: 800,
        net: 0,
        closing: 800,
        entries: 0,
        minimumBalance: 800,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "committed", revision: 1, checkpoint: 4 },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 4,
        minimumBalance: 700,
        debits: 3,
        debitAmountAtPercentile: 100,
      },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 4,
        minimumBalance: 700,
        debits: 3,
        debitAmountAtPercentile: 300,
      },
      {
        opening: 1_000,
        net: 0,
        closing: 1_000,
        entries: 0,
        minimumBalance: 1_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
    ],
  },
  {
    name: "distribución histórica, reemplazos de signo y rechazos atómicos",
    setup: {
      accounts: [
        { id: "caja", opening: 1_000 },
        { id: "tienda", opening: 0 },
      ],
    },
    operations: [
      {
        kind: "amend",
        amendment: {
          id: "uno",
          expectedRevision: 0,
          entry: {
            at: 10,
            legs: [
              { account: "caja", delta: -100 },
              { account: "tienda", delta: 100 },
            ],
          },
        },
      },
      {
        kind: "amend",
        amendment: {
          id: "dos",
          expectedRevision: 0,
          entry: {
            at: 20,
            legs: [
              { account: "caja", delta: -300 },
              { account: "tienda", delta: 300 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 2, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: {
          id: "dos",
          expectedRevision: 1,
          entry: {
            at: 5,
            legs: [
              { account: "caja", delta: -200 },
              { account: "tienda", delta: 200 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 3, percentile: 100 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 2, percentile: 100 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 10, asOf: 3, percentile: 50 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 10, asOf: 2, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: {
          id: "uno",
          expectedRevision: 1,
          entry: {
            at: 8,
            legs: [
              { account: "caja", delta: -900 },
              { account: "tienda", delta: 900 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 3, percentile: 100 },
      },
      {
        kind: "amend",
        amendment: { id: "dos", expectedRevision: 1, entry: null },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 3, percentile: 100 },
      },
      {
        kind: "amend",
        amendment: {
          id: "dos",
          expectedRevision: 2,
          entry: {
            at: 20,
            legs: [
              { account: "caja", delta: 50 },
              { account: "tienda", delta: -50 },
            ],
          },
        },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 4, percentile: 100 },
      },
      {
        kind: "report",
        report: { account: "tienda", from: 0, to: 30, asOf: 4, percentile: 50 },
      },
      {
        kind: "amend",
        amendment: { id: "dos", expectedRevision: 3, entry: null },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 5, percentile: 100 },
      },
      {
        kind: "amend",
        amendment: { id: "uno", expectedRevision: 1, entry: null },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 6, percentile: 100 },
      },
      {
        kind: "report",
        report: { account: "caja", from: 0, to: 30, asOf: 3, percentile: 100 },
      },
    ],
    expected: [
      { kind: "committed", revision: 1, checkpoint: 1 },
      { kind: "committed", revision: 1, checkpoint: 2 },
      {
        opening: 1_000,
        net: -400,
        closing: 600,
        entries: 2,
        minimumBalance: 600,
        debits: 2,
        debitAmountAtPercentile: 100,
      },
      { kind: "committed", revision: 2, checkpoint: 3 },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 2,
        minimumBalance: 700,
        debits: 2,
        debitAmountAtPercentile: 200,
      },
      {
        opening: 1_000,
        net: -400,
        closing: 600,
        entries: 2,
        minimumBalance: 600,
        debits: 2,
        debitAmountAtPercentile: 300,
      },
      {
        opening: 1_000,
        net: -200,
        closing: 800,
        entries: 1,
        minimumBalance: 800,
        debits: 1,
        debitAmountAtPercentile: 200,
      },
      {
        opening: 1_000,
        net: 0,
        closing: 1_000,
        entries: 0,
        minimumBalance: 1_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      { kind: "insolvent", account: "caja", at: 8, balance: -100 },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 2,
        minimumBalance: 700,
        debits: 2,
        debitAmountAtPercentile: 200,
      },
      { kind: "conflict", revision: 2 },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 2,
        minimumBalance: 700,
        debits: 2,
        debitAmountAtPercentile: 200,
      },
      { kind: "committed", revision: 3, checkpoint: 4 },
      {
        opening: 1_000,
        net: -50,
        closing: 950,
        entries: 2,
        minimumBalance: 900,
        debits: 1,
        debitAmountAtPercentile: 100,
      },
      {
        opening: 0,
        net: 50,
        closing: 50,
        entries: 2,
        minimumBalance: 0,
        debits: 1,
        debitAmountAtPercentile: 50,
      },
      { kind: "committed", revision: 4, checkpoint: 5 },
      {
        opening: 1_000,
        net: -100,
        closing: 900,
        entries: 1,
        minimumBalance: 900,
        debits: 1,
        debitAmountAtPercentile: 100,
      },
      { kind: "committed", revision: 2, checkpoint: 6 },
      {
        opening: 1_000,
        net: 0,
        closing: 1_000,
        entries: 0,
        minimumBalance: 1_000,
        debits: 0,
        debitAmountAtPercentile: null,
      },
      {
        opening: 1_000,
        net: -300,
        closing: 700,
        entries: 2,
        minimumBalance: 700,
        debits: 2,
        debitAmountAtPercentile: 200,
      },
    ],
  },
];
