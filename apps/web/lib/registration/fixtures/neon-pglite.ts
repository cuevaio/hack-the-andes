import assert from "node:assert/strict";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { Option, Schema } from "effect";

const statementSchema = Schema.Struct({
  query: Schema.String,
  params: Schema.Array(Schema.NullOr(Schema.String)),
});
const requestSchema = Schema.Union([
  statementSchema,
  Schema.Struct({ queries: Schema.Array(statementSchema) }),
]);
const errorSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.String,
  severity: Schema.optional(Schema.String),
  constraint: Schema.optional(Schema.String),
});

export const createPgliteFetch = async (pg: PGlite) => {
  const catalog = await pg.query<{ oid: number }>(
    "select oid::int as oid from pg_type",
  );
  const textIdentity = (value: string) => value;
  const codecs = Object.fromEntries(
    catalog.rows.map(({ oid }) => [oid, textIdentity]),
  );
  const execute = async (
    executor: Pick<Transaction, "query">,
    statement: typeof statementSchema.Type,
  ) => {
    const result = await executor.query(
      statement.query,
      [...statement.params],
      {
        rowMode: "array",
        parsers: codecs,
        serializers: codecs,
      },
    );
    return {
      rows: result.rows,
      fields: result.fields,
      command: result.command ?? "",
      rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length,
    };
  };
  return async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    assert.equal(request.method, "POST");
    assert.equal(request.headers.get("Neon-Array-Mode"), "true");
    assert.equal(request.headers.get("Neon-Raw-Text-Output"), "true");
    for (const header of [
      "Neon-Batch-Isolation-Level",
      "Neon-Batch-Read-Only",
      "Neon-Batch-Deferrable",
    ]) {
      assert.equal(request.headers.has(header), false);
    }
    const payload = Schema.decodeUnknownSync(requestSchema)(
      await request.json(),
    );
    try {
      if ("queries" in payload) {
        const results = await pg.transaction(async (transaction) => {
          const results = [];
          for (const statement of payload.queries)
            results.push(await execute(transaction, statement));
          return results;
        });
        return Response.json({ results });
      }
      return Response.json(await execute(pg, payload));
    } catch (error) {
      const parsed = Schema.decodeUnknownOption(errorSchema)(error);
      if (Option.isNone(parsed)) throw error;
      return Response.json(parsed.value, { status: 400 });
    }
  };
};
