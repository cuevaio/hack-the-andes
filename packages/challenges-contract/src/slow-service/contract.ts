export const timestampLimit = 2_147_483_648;
export const acceptedLegEditLimit = 72_000;
export const activeJournalLimit = 24_000;

export interface LedgerSetup {
  readonly accounts: ReadonlyArray<{
    readonly id: string;
    readonly opening: number;
  }>;
}

export interface JournalEntry {
  readonly at: number;
  readonly legs: ReadonlyArray<{
    readonly account: string;
    readonly delta: number;
  }>;
}

export interface Amendment {
  readonly id: string;
  readonly expectedRevision: number;
  readonly entry: JournalEntry | null;
}

export type AmendmentResult =
  | {
      readonly kind: "committed";
      readonly revision: number;
      readonly checkpoint: number;
    }
  | { readonly kind: "conflict"; readonly revision: number }
  | {
      readonly kind: "insolvent";
      readonly account: string;
      readonly at: number;
      readonly balance: number;
    };

export interface ReportRequest {
  readonly account: string;
  readonly from: number;
  readonly to: number;
  readonly asOf: number;
  readonly percentile: number;
}

export interface BalanceReport {
  readonly opening: number;
  readonly net: number;
  readonly closing: number;
  readonly entries: number;
  readonly minimumBalance: number;
  readonly debits: number;
  readonly debitAmountAtPercentile: number | null;
}

export type LedgerOperation =
  | { readonly kind: "amend"; readonly amendment: Amendment }
  | { readonly kind: "report"; readonly report: ReportRequest };
export type LedgerResult = AmendmentResult | BalanceReport;

export interface Ledger {
  amend(amendment: Amendment): AmendmentResult;
  report(report: ReportRequest): BalanceReport;
}
