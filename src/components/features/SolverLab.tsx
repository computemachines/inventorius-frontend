import * as React from "react";
import { FormEvent, useContext, useState } from "react";

import { ApiContext } from "@api/api-client";
import type { Problem, SolverQueryRequest } from "@api/data-models";
import PageHeading from "@components/primitives/PageHeading";


const ONE = { numerator: "1", denominator: "1" };

const INITIAL_SNAPSHOT = JSON.stringify({
  revision: 1,
  variables: [
    { variable_id: "red-in-a", unit: "each", domain: "discrete" },
    { variable_id: "red-in-b", unit: "each", domain: "discrete" },
  ],
  constraints: [
    {
      constraint_id: "part-a:capacity",
      coefficients: { "red-in-a": ONE },
      relation: "at-most",
      bound: { numerator: "24", denominator: "1" },
    },
    {
      constraint_id: "part-b:capacity",
      coefficients: { "red-in-b": ONE },
      relation: "at-most",
      bound: { numerator: "25", denominator: "1" },
    },
    {
      constraint_id: "red:shared-total",
      coefficients: { "red-in-a": ONE, "red-in-b": ONE },
      relation: "equal",
      bound: { numerator: "25", denominator: "1" },
    },
  ],
}, null, 2);

const INITIAL_OVERLAY = JSON.stringify({
  variables: [],
  constraints: [],
}, null, 2);

const INITIAL_QUERY = JSON.stringify({
  kind: "expression-bounds",
  expression: { "red-in-a": ONE, "red-in-b": ONE },
}, null, 2);

const editorClasses =
  "block w-full min-h-64 p-3 font-mono text-sm border border-[#cdd2d6] " +
  "rounded-md bg-white text-[#04151f] focus:outline-none focus:border-[#0c3764] " +
  "focus:ring-[3px] focus:ring-[#0c3764]/15";

function errorMessage(error: unknown): string {
  if (error instanceof SyntaxError) return `Invalid JSON: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "The solver query failed.";
}

function problemMessage(problem: Problem): string {
  return (
    problem["invalid-params"]?.[0]?.reason ||
    problem.detail ||
    problem.title ||
    "The API rejected the solver query."
  );
}

export default function SolverLab() {
  const api = useContext(ApiContext);
  const [snapshotText, setSnapshotText] = useState(INITIAL_SNAPSHOT);
  const [overlayText, setOverlayText] = useState(INITIAL_OVERLAY);
  const [queryText, setQueryText] = useState(INITIAL_QUERY);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runQuery = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const command: SolverQueryRequest = {
        snapshot: JSON.parse(snapshotText),
        overlay: JSON.parse(overlayText),
        query: JSON.parse(queryText),
      };
      const response = await api.evaluateSolverQuery(command);
      if ("state" in response) {
        setResult(response.state.result);
      } else {
        setError(problemMessage(response));
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeading>Advanced Solver Lab</PageHeading>
      <p>
        Run one fresh query against a supplied constraint snapshot and temporary
        overlay. Nothing entered here is saved to inventory history.
      </p>
      <form onSubmit={runQuery}>
        <label className="block font-semibold mt-6 mb-2" htmlFor="solver-snapshot">
          ConstraintGraphSnapshot
        </label>
        <textarea
          id="solver-snapshot"
          className={editorClasses}
          spellCheck={false}
          value={snapshotText}
          onChange={(event) => setSnapshotText(event.target.value)}
        />

        <label className="block font-semibold mt-6 mb-2" htmlFor="solver-overlay">
          ConstraintOverlay
        </label>
        <textarea
          id="solver-overlay"
          className={editorClasses}
          spellCheck={false}
          value={overlayText}
          onChange={(event) => setOverlayText(event.target.value)}
        />

        <label className="block font-semibold mt-6 mb-2" htmlFor="solver-query">
          Query
        </label>
        <textarea
          id="solver-query"
          className={editorClasses}
          spellCheck={false}
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
        />

        <button
          type="submit"
          disabled={running}
          className="mt-4 py-2 px-4 rounded bg-[#0c3764] text-white disabled:opacity-60"
        >
          {running ? "Running…" : "Run fresh query"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-5 p-3 border border-red-700 text-red-800">
          {error}
        </p>
      )}
      {result && (
        <section className="mt-8" aria-labelledby="solver-result-heading">
          <h3 id="solver-result-heading" className="text-xl font-semibold mb-2">
            Structured result
          </h3>
          <pre className="overflow-x-auto p-4 bg-[#f4f5f6] border border-[#cdd2d6] rounded-md">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
