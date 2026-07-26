import * as React from "react";
import { parse } from "query-string";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import {
  AuditObservationRequest,
  AuditObservationState,
  AuditReconciliationRequest,
  AuditSnapshotBlocker,
  AuditSnapshotHolding,
  AuditSnapshotResult,
  InventoryOperationReceipt,
} from "../../api-client/data-models";
import { normalizeInventoriusId } from "../../identifiers";
import { Code } from "../composites/CodesInput";
import InventoryBatchSelector from "../composites/InventoryBatchSelector";
import ItemLabel from "../primitives/ItemLabel";
import ReceiptTime from "../primitives/ReceiptTime";
import {
  inputClasses,
  isBinId,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

type AuditPhase = "counting" | "review" | "stale" | "recorded";
type ExpectedClassification = "Matched" | "Missing" | "Overage" | "Shortage";

interface UnexpectedCount {
  batchId: string;
  observed: string;
}

function blankEvidence(): Code[] {
  return [{ value: "", kind: "associated" }];
}

function wholeNumber(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isExplicitWholeNumber(value: string, minimum = 0): boolean {
  if (value.trim() === "") return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum;
}

function holdingKey(holding: AuditSnapshotHolding, index: number): string {
  return [
    holding.batch_id,
    holding.packaging_configuration_id ?? "unpackaged",
    holding.unit,
    index,
  ].join(":");
}

function holdingName(holding: AuditSnapshotHolding): string {
  return holding.batch_name || "Unnamed batch";
}

function recordedQuantity(holding: AuditSnapshotHolding): string {
  return `${String(holding.quantity)} ${holding.unit}`;
}

function isNonzeroQuantity(value: number | string): boolean {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed !== 0;
}

function reconciliationRejectionMessage(
  blocker: string | undefined,
  detail: string | undefined,
): string {
  switch (blocker) {
  case "snapshot-stale":
    return "Canonical holdings changed after this count was recorded. The audit observation is still preserved, but reconciliation was not applied. Recount the bin before changing inventory.";
  case "snapshot-blocked":
    return "The current inventory contains data this reconciliation cannot safely represent. The audit observation is still preserved. Resolve the blocker, then recount the bin before changing inventory.";
  case "unresolved-evidence":
    return "This observation contains unresolved physical evidence, so inventory was not changed. Recount the bin and resolve that evidence before reconciling.";
  case "no-variance":
    return "The physical count already matches canonical holdings, so there is no unexplained variance to reconcile.";
  case "already-reconciled":
    return "This observation already has a reconciliation. No second inventory change was made; start a new count before making any further change.";
  case "insufficient-holding":
    return "The recorded inventory is no longer available, so reconciliation was not applied. The audit observation is still preserved; recount the bin.";
  default:
    return `${
      detail || "The reconciliation was rejected."
    } The audit observation is still preserved; recount the bin before trying another inventory change.`;
  }
}

function expectedClassification(
  recorded: number,
  observed: number,
): ExpectedClassification {
  if (observed === recorded) return "Matched";
  if (observed === 0) return "Missing";
  if (observed > recorded) return "Overage";
  return "Shortage";
}

function classificationClasses(classification: ExpectedClassification): string {
  switch (classification) {
  case "Matched":
    return "border-green-300 bg-green-50 text-green-800";
  case "Missing":
    return "border-red-300 bg-red-50 text-red-800";
  case "Overage":
    return "border-blue-300 bg-blue-50 text-blue-800";
  case "Shortage":
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
}

function blockerDescription(blocker: AuditSnapshotBlocker): string {
  if (blocker.type === "legacy-bin-contents") {
    const count =
      "entry_count" in blocker && typeof blocker.entry_count === "number"
        ? blocker.entry_count
        : 0;
    return `${count} legacy bin-content ${
      count === 1 ? "entry exists" : "entries exist"
    } outside the current holdings ledger. Those entries cannot be compared safely.`;
  }

  if (blocker.type === "unsupported-holding-shapes") {
    const count =
      "holding_count" in blocker && typeof blocker.holding_count === "number"
        ? blocker.holding_count
        : 0;
    return `${count} recorded ${
      count === 1 ? "holding uses" : "holdings use"
    } a quantity, unit, or package shape this counting flow cannot compare yet.`;
  }

  return `The API reported an unsupported audit condition: ${blocker.type}.`;
}

function CountingStatus({
  holding,
  observed,
}: {
  holding: AuditSnapshotHolding;
  observed: string;
}) {
  if (observed.trim() === "") {
    return <span className="text-[#6d635d]">Not counted</span>;
  }
  if (!isExplicitWholeNumber(observed)) {
    return (
      <span className="text-red-700">Enter a nonnegative whole number</span>
    );
  }

  const recorded = wholeNumber(holding.quantity);
  if (!holding.supported || recorded === null) {
    return (
      <span className="text-amber-800">
        Count noted, but this holding shape cannot be compared
      </span>
    );
  }

  const count = Number(observed);
  const classification = expectedClassification(recorded, count);
  if (classification === "Matched") {
    return <span className="text-green-800">Matches recorded quantity</span>;
  }
  if (classification === "Missing") {
    return (
      <span className="text-red-800">
        Missing {recorded} {holding.unit}
      </span>
    );
  }
  if (classification === "Overage") {
    return (
      <span className="text-blue-800">
        Overage of {count - recorded} {holding.unit}
      </span>
    );
  }
  return (
    <span className="text-amber-800">
      Shortage of {recorded - count} {holding.unit}
    </span>
  );
}

export default function Audit() {
  const api = React.useContext(ApiContext);
  const observationIdempotency = useCommandIdempotency();
  const reconciliationIdempotency = useCommandIdempotency();
  const location = useLocation();
  const navigate = useNavigate();
  const binInput = React.useRef<HTMLInputElement>(null);
  const handledQueryBin = React.useRef<string | null>(null);
  const loadGeneration = React.useRef(0);
  const reviewGeneration = React.useRef(0);
  const recordGeneration = React.useRef(0);
  const reconciliationGeneration = React.useRef(0);

  const [binId, setBinId] = React.useState("");
  const [snapshot, setSnapshot] = React.useState<AuditSnapshotResult | null>(
    null,
  );
  const [observedCounts, setObservedCounts] = React.useState<
    Record<string, string>
  >({});
  const [unexpectedCounts, setUnexpectedCounts] = React.useState<
    UnexpectedCount[]
  >([]);
  const [itemEvidence, setItemEvidence] = React.useState<Code[]>(blankEvidence);
  const [selectedBatchId, setSelectedBatchId] = React.useState("");
  const [pendingUnexpectedCount, setPendingUnexpectedCount] =
    React.useState("");
  const [recordedObservation, setRecordedObservation] =
    React.useState<AuditObservationState | null>(null);
  const [reconciliationNote, setReconciliationNote] = React.useState("");
  const [reconciliationReceipt, setReconciliationReceipt] =
    React.useState<InventoryOperationReceipt | null>(null);
  const [reconciliationError, setReconciliationError] = React.useState("");
  const [phase, setPhase] = React.useState<AuditPhase>("counting");
  const [loading, setLoading] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [reconciling, setReconciling] = React.useState(false);
  const [error, setError] = React.useState("");

  const resetCount = React.useCallback((nextSnapshot: AuditSnapshotResult) => {
    setSnapshot(nextSnapshot);
    setObservedCounts({});
    setUnexpectedCounts([]);
    setItemEvidence(blankEvidence());
    setSelectedBatchId("");
    setPendingUnexpectedCount("");
    setRecordedObservation(null);
    setReconciliationNote("");
    setReconciliationReceipt(null);
    setReconciliationError("");
    setPhase("counting");
  }, []);

  const loadSnapshot = React.useCallback(
    async (canonicalBinId: string) => {
      const generation = ++loadGeneration.current;
      ++reviewGeneration.current;
      ++recordGeneration.current;
      ++reconciliationGeneration.current;
      setLoading(true);
      setReviewing(false);
      setRecording(false);
      setReconciling(false);
      setError("");
      setSnapshot(null);

      try {
        const response = await api.getAuditSnapshot(canonicalBinId);
        if (generation !== loadGeneration.current) return;
        if (response.kind === "problem") {
          setError(response.title);
          return;
        }
        resetCount(response);
      } catch {
        if (generation !== loadGeneration.current) return;
        setError(
          "Could not load the recorded inventory. Check the API and retry.",
        );
      } finally {
        if (generation === loadGeneration.current) setLoading(false);
      }
    },
    [api, resetCount],
  );

  React.useEffect(() => {
    const query = parse(location.search);
    if (typeof query.bin !== "string") return;

    const canonicalBinId = normalizeInventoriusId(query.bin);
    setBinId(canonicalBinId);
    if (!isBinId(canonicalBinId)) {
      ++loadGeneration.current;
      ++reviewGeneration.current;
      ++recordGeneration.current;
      ++reconciliationGeneration.current;
      setSnapshot(null);
      setLoading(false);
      setReviewing(false);
      setRecording(false);
      setReconciling(false);
      setRecordedObservation(null);
      setReconciliationNote("");
      setReconciliationReceipt(null);
      setReconciliationError("");
      setError("Scan or enter a valid BIN label.");
      return;
    }
    if (handledQueryBin.current === canonicalBinId) return;

    handledQueryBin.current = canonicalBinId;
    void loadSnapshot(canonicalBinId);
  }, [loadSnapshot, location.search]);

  React.useEffect(() => {
    setPendingUnexpectedCount("");
  }, [selectedBatchId]);

  const loadBin = (event: React.FormEvent) => {
    event.preventDefault();
    const canonicalBinId = normalizeInventoriusId(binId);
    setBinId(canonicalBinId);
    setError("");

    if (!isBinId(canonicalBinId)) {
      setError("Scan or enter a valid BIN label.");
      binInput.current?.focus();
      return;
    }

    handledQueryBin.current = canonicalBinId;
    void loadSnapshot(canonicalBinId);
    navigate(`/audit?bin=${encodeURIComponent(canonicalBinId)}`, {
      replace: true,
    });
  };

  const state = snapshot?.state;
  const expectedHoldings = React.useMemo(
    () =>
      (state?.holdings ?? []).filter((holding) => {
        const quantity = Number(holding.quantity);
        return !Number.isFinite(quantity) || quantity > 0;
      }),
    [state?.holdings],
  );
  const expectedBatchIds = React.useMemo(
    () => new Set(expectedHoldings.map((holding) => holding.batch_id)),
    [expectedHoldings],
  );
  const selectedIsExpected = expectedBatchIds.has(selectedBatchId);
  const selectedIsAlreadyUnexpected = unexpectedCounts.some(
    ({ batchId }) => batchId === selectedBatchId,
  );
  const hasPendingUnexpectedSelection =
    !!selectedBatchId && !selectedIsExpected && !selectedIsAlreadyUnexpected;
  const hasUnsupportedHolding = expectedHoldings.some(
    (holding) => !holding.supported || wholeNumber(holding.quantity) === null,
  );
  const isBlocked = (state?.blockers.length ?? 0) > 0 || hasUnsupportedHolding;
  const everyExpectedCounted = expectedHoldings.every((holding, index) =>
    isExplicitWholeNumber(observedCounts[holdingKey(holding, index)] ?? ""),
  );
  const everyUnexpectedCounted = unexpectedCounts.every(({ observed }) =>
    isExplicitWholeNumber(observed, 1),
  );
  const hasPhysicalEvidence =
    expectedHoldings.length > 0 || unexpectedCounts.length > 0;
  const canReview =
    !!snapshot &&
    !isBlocked &&
    hasPhysicalEvidence &&
    everyExpectedCounted &&
    everyUnexpectedCounted &&
    phase !== "stale";
  const unresolvedEvidence = React.useMemo(() => {
    if (selectedBatchId && !hasPendingUnexpectedSelection) return [];
    return Array.from(
      new Set(
        itemEvidence
          .map(({ value }) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  }, [hasPendingUnexpectedSelection, itemEvidence, selectedBatchId]);
  const observationCommand =
    React.useMemo<AuditObservationRequest | null>(() => {
      if (!snapshot) return null;

      return {
        location_id: snapshot.state.location_id,
        snapshot_token: snapshot.state.snapshot_token,
        counts: [
          ...expectedHoldings.map((holding, index) => ({
            batch_id: holding.batch_id,
            quantity: Number(observedCounts[holdingKey(holding, index)] ?? ""),
            unit: "each" as const,
            packaging_configuration_id: null,
          })),
          ...unexpectedCounts.map(({ batchId, observed }) => ({
            batch_id: batchId,
            quantity: Number(observed),
            unit: "each" as const,
            packaging_configuration_id: null,
          })),
        ],
        ...(unresolvedEvidence.length
          ? { unresolved_evidence: unresolvedEvidence }
          : {}),
      };
    }, [
      expectedHoldings,
      observedCounts,
      snapshot,
      unexpectedCounts,
      unresolvedEvidence,
    ]);
  const recordedHasVariance =
    recordedObservation?.counts.some(({ difference }) =>
      isNonzeroQuantity(difference),
    ) ?? false;
  const recordedHasUnresolvedEvidence =
    (recordedObservation?.unresolved_evidence.length ?? 0) > 0;
  const reconciledOperationId =
    reconciliationReceipt?.operation_id ??
    recordedObservation?.reconciled_by_operation_id ??
    null;
  const canReconcile =
    !!recordedObservation &&
    recordedHasVariance &&
    !recordedHasUnresolvedEvidence &&
    !reconciledOperationId;

  const addUnexpected = () => {
    if (
      !selectedBatchId ||
      selectedIsExpected ||
      selectedIsAlreadyUnexpected ||
      !isExplicitWholeNumber(pendingUnexpectedCount, 1)
    ) {
      return;
    }

    setUnexpectedCounts((counts) => [
      ...counts,
      {
        batchId: selectedBatchId,
        observed: String(Number(pendingUnexpectedCount)),
      },
    ]);
    setItemEvidence(blankEvidence());
    setSelectedBatchId("");
    setPendingUnexpectedCount("");
  };

  const reviewCounts = async () => {
    if (!snapshot || !canReview) return;

    const generation = ++reviewGeneration.current;
    setReviewing(true);
    setError("");
    try {
      const current = await api.getAuditSnapshot(snapshot.state.location_id);
      if (generation !== reviewGeneration.current) return;
      if (current.kind === "problem") {
        setError(current.title);
        return;
      }
      if (current.state.snapshot_token !== snapshot.state.snapshot_token) {
        setPhase("stale");
        return;
      }
      setPhase("review");
    } catch {
      if (generation !== reviewGeneration.current) return;
      setError(
        "Could not verify the recorded inventory. Your counts are still here; retry the review.",
      );
    } finally {
      if (generation === reviewGeneration.current) setReviewing(false);
    }
  };

  const recordCount = async () => {
    if (!observationCommand || phase !== "review" || recording) return;

    const generation = ++recordGeneration.current;
    setRecording(true);
    setError("");
    try {
      const response = await api.recordAuditObservation(
        observationCommand,
        observationIdempotency.keyFor(observationCommand),
      );
      if (generation !== recordGeneration.current) return;

      if (response.kind === "problem") {
        if (response.type === "audit-snapshot-stale") {
          setPhase("stale");
          return;
        }

        const reason = [response.title, response.detail]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.trim().replace(/[.]+$/, ""))
          .join(". ");
        setError(
          `${reason}. Your entered counts and unresolved evidence are still here.`,
        );
        return;
      }

      observationIdempotency.clear();
      setRecordedObservation(response.state);
      setPhase("recorded");
    } catch {
      if (generation !== recordGeneration.current) return;
      setError(
        "The observation could not be confirmed. Your counts, unresolved evidence, and retry identity are still here.",
      );
    } finally {
      if (generation === recordGeneration.current) setRecording(false);
    }
  };

  const reconcileCount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recordedObservation || !canReconcile || reconciling) return;

    const disposition: AuditReconciliationRequest = {
      reason: "unexplained-variance",
      ...(reconciliationNote.trim()
        ? { note: reconciliationNote.trim() }
        : {}),
    };
    const commandIdentity = {
      observation_id: recordedObservation.observation_id,
      ...disposition,
    };
    const generation = ++reconciliationGeneration.current;
    setReconciling(true);
    setReconciliationError("");
    try {
      const response = await api.reconcileAuditObservation(
        recordedObservation.observation_id,
        disposition,
        reconciliationIdempotency.keyFor(commandIdentity),
      );
      if (generation !== reconciliationGeneration.current) return;

      if (response.kind === "problem") {
        if (response.type === "audit-reconciliation-rejected") {
          setReconciliationError(
            reconciliationRejectionMessage(response.blocker, response.detail),
          );
        } else {
          const reason = [response.title, response.detail]
            .filter((value): value is string => Boolean(value))
            .map((value) => value.trim().replace(/[.]+$/, ""))
            .join(". ");
          setReconciliationError(
            `${reason}. The audit observation and your note are still here.`,
          );
        }
        return;
      }

      reconciliationIdempotency.clear();
      setReconciliationReceipt(response.state);
      setRecordedObservation((observation) =>
        observation
          ? {
            ...observation,
            reconciled_by_operation_id: response.state.operation_id,
          }
          : observation,
      );
      setReconciliationError("");
    } catch {
      if (generation !== reconciliationGeneration.current) return;
      setReconciliationError(
        "The reconciliation could not be confirmed. The audit observation, note, and retry identity are still here; retry without changing the note.",
      );
    } finally {
      if (generation === reconciliationGeneration.current) {
        setReconciling(false);
      }
    }
  };

  const startAnotherBin = () => {
    ++loadGeneration.current;
    ++reviewGeneration.current;
    ++recordGeneration.current;
    ++reconciliationGeneration.current;
    handledQueryBin.current = null;
    setBinId("");
    setSnapshot(null);
    setObservedCounts({});
    setUnexpectedCounts([]);
    setItemEvidence(blankEvidence());
    setSelectedBatchId("");
    setPendingUnexpectedCount("");
    setRecordedObservation(null);
    setReconciliationNote("");
    setReconciliationReceipt(null);
    setReconciliationError("");
    setPhase("counting");
    setLoading(false);
    setReviewing(false);
    setRecording(false);
    setReconciling(false);
    setError("");
    navigate("/audit", { replace: true });
    globalThis.requestAnimationFrame(() => binInput.current?.focus());
  };

  const captureHref = state
    ? `/capture?into=${encodeURIComponent(state.location_id)}`
    : "/capture";

  return (
    <div className="max-w-[48rem] mx-auto">
      <h1 className="text-2xl font-bold text-[#04151f] mb-2">Audit a bin</h1>
      <p className="text-[#6d635d] mb-2">
        Compare the physical truth in one bin with its recorded holdings.
      </p>
      <p
        className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3
          text-sm font-semibold text-blue-900"
      >
        Recording a count preserves physical evidence. It does not receive,
        release, move, or adjust inventory.
      </p>

      <form onSubmit={loadBin} autoComplete="off" className="mb-7">
        <label htmlFor="audit-bin" className={labelClasses}>
          Bin
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            ref={binInput}
            id="audit-bin"
            value={binId}
            onChange={(event) => setBinId(event.target.value)}
            onBlur={() => setBinId(normalizeInventoriusId(binId))}
            placeholder="BIN000001"
            spellCheck={false}
            autoFocus
            className={inputClasses}
          />
          <button
            type="submit"
            disabled={loading || recording || reconciling}
            className={`${submitClasses} sm:w-auto sm:min-w-36`}
          >
            {loading ? "Loading…" : "Load bin"}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3
            text-red-700"
        >
          {error}
        </div>
      )}

      {loading && (
        <p role="status" className="text-[#6d635d]">
          Loading recorded inventory…
        </p>
      )}

      {state && phase === "recorded" && recordedObservation && (
        <section aria-labelledby="audit-recorded-title">
          <h2
            id="audit-recorded-title"
            className="text-xl font-bold text-[#04151f] mb-3"
          >
            Count recorded for <ItemLabel label={state.location_id} />
          </h2>
          <div
            role="status"
            className="mb-6 rounded-md border border-green-300 bg-green-50 px-4
              py-4 text-green-950"
          >
            <p className="text-lg font-bold">Physical evidence recorded</p>
            <p className="mt-2">
              Observation{" "}
              <code className="break-all font-semibold">
                {recordedObservation.observation_id}
              </code>
            </p>
            <p className="mt-1">
              Recorded <ReceiptTime value={recordedObservation.recorded_at} />
            </p>
            <p className="mt-3 text-sm font-semibold">
              This preserved the count as physical evidence. It did not adjust
              inventory.
            </p>
          </div>

          {reconciliationError && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-red-300 bg-red-50 px-4
                py-3 text-red-800"
            >
              {reconciliationError}
            </div>
          )}

          {reconciliationReceipt ? (
            <section
              aria-labelledby="audit-reconciliation-recorded-title"
              className="mb-6 rounded-md border border-green-300 bg-green-50
                px-4 py-4 text-green-950"
            >
              <h3
                id="audit-reconciliation-recorded-title"
                className="text-lg font-bold"
              >
                Inventory reconciled to the physical count
              </h3>
              <p className="mt-2">
                Operation{" "}
                <Link
                  className="break-all font-semibold underline"
                  to={`/activity/${encodeURIComponent(
                    reconciliationReceipt.operation_id,
                  )}`}
                >
                  {reconciliationReceipt.operation_id}
                </Link>{" "}
                was recorded{" "}
                <ReceiptTime value={reconciliationReceipt.created_at} />.
              </p>
              <p className="mt-3 text-sm font-semibold">
                Canonical holdings now match the observed quantities. The
                operation records the differences as unexplained inventory
                variance; it does not establish a cause.
              </p>
              <button
                type="button"
                onClick={startAnotherBin}
                className={`${submitClasses} mt-4 sm:w-auto sm:min-w-44`}
              >
                Count next bin
              </button>
            </section>
          ) : reconciledOperationId ? (
            <section
              aria-labelledby="audit-already-reconciled-title"
              className="mb-6 rounded-md border border-blue-300 bg-blue-50 px-4
                py-4 text-blue-950"
            >
              <h3 id="audit-already-reconciled-title" className="font-bold">
                Inventory was already reconciled
              </h3>
              <p className="mt-2">
                This observation is linked to operation{" "}
                <Link
                  className="break-all font-semibold underline"
                  to={`/activity/${encodeURIComponent(reconciledOperationId)}`}
                >
                  {reconciledOperationId}
                </Link>
                . No second inventory change is available from this count.
              </p>
              <button
                type="button"
                onClick={startAnotherBin}
                className={`${submitClasses} mt-4 sm:w-auto sm:min-w-44`}
              >
                Count next bin
              </button>
            </section>
          ) : recordedHasUnresolvedEvidence ? (
            <section
              aria-labelledby="audit-reconciliation-unresolved-title"
              className="mb-6 rounded-md border border-amber-300 bg-amber-50
                px-4 py-4 text-amber-950"
            >
              <h3
                id="audit-reconciliation-unresolved-title"
                className="font-bold"
              >
                Reconciliation unavailable
              </h3>
              <p className="mt-2">
                This observation preserves unresolved physical evidence.
                Inventory cannot be changed from an incomplete count. Recount
                the bin and resolve that evidence first.
              </p>
              <button
                type="button"
                onClick={startAnotherBin}
                className={`${submitClasses} mt-4 sm:w-auto sm:min-w-44`}
              >
                Count next bin
              </button>
            </section>
          ) : !recordedHasVariance ? (
            <section
              aria-labelledby="audit-reconciliation-matched-title"
              className="mb-6 rounded-md border border-blue-300 bg-blue-50 px-4
                py-4 text-blue-950"
            >
              <h3
                id="audit-reconciliation-matched-title"
                className="font-bold"
              >
                Reconciliation unavailable
              </h3>
              <p className="mt-2">
                The physical count matched canonical holdings. There is no
                unexplained variance to apply.
              </p>
              <button
                type="button"
                onClick={startAnotherBin}
                className={`${submitClasses} mt-4 sm:w-auto sm:min-w-44`}
              >
                Count next bin
              </button>
            </section>
          ) : (
            <>
              <form
                onSubmit={reconcileCount}
                aria-labelledby="audit-reconciliation-title"
                className="mb-4 rounded-md border-2 border-amber-400 bg-amber-50
                  px-4 py-4 text-amber-950"
              >
                <h3 id="audit-reconciliation-title" className="text-lg font-bold">
                  Reconcile inventory to this count
                </h3>
                <p className="mt-2 font-semibold">
                  This action changes canonical holdings to the observed
                  quantities and records the differences as unexplained
                  inventory variance. It does not establish why the variance
                  occurred.
                </p>
                <label
                  htmlFor="audit-reconciliation-note"
                  className={`${labelClasses} mt-4`}
                >
                  Note (optional)
                </label>
                <textarea
                  id="audit-reconciliation-note"
                  value={reconciliationNote}
                  onChange={(event) =>
                    setReconciliationNote(event.target.value)
                  }
                  maxLength={500}
                  rows={3}
                  disabled={reconciling}
                  className={inputClasses}
                />
                <p className="mt-1.5 text-sm">
                  Record useful counting context without claiming a cause that
                  is not known.
                </p>
                <button
                  type="submit"
                  disabled={reconciling}
                  className="mt-4 w-full rounded-md bg-amber-900 px-5 py-3
                    font-semibold text-white hover:bg-amber-950
                    disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  {reconciling
                    ? "Reconciling inventory…"
                    : "Reconcile inventory to physical count"}
                </button>
              </form>
              <button
                type="button"
                disabled={reconciling}
                onClick={startAnotherBin}
                className="rounded-md border border-[#26532b] bg-white px-5 py-3
                  font-semibold text-[#26532b] hover:bg-green-50
                  disabled:cursor-wait disabled:opacity-60"
              >
                Count next bin without reconciling
              </button>
            </>
          )}
        </section>
      )}

      {state && phase === "review" && (
        <section aria-labelledby="audit-review-title">
          <h2
            id="audit-review-title"
            className="text-xl font-bold text-[#04151f] mb-2"
          >
            Review count for <ItemLabel label={state.location_id} />
          </h2>
          <div
            role="status"
            className="mb-5 rounded-md border border-green-300 bg-green-50 px-4
              py-3 text-lg font-bold text-green-900"
          >
            Inventory has not changed. Review the evidence below before
            recording it.
          </div>

          <ul className="space-y-3 mb-6">
            {expectedHoldings.map((holding, index) => {
              const key = holdingKey(holding, index);
              const recorded = wholeNumber(holding.quantity) ?? 0;
              const observed = Number(observedCounts[key]);
              const classification = expectedClassification(recorded, observed);
              const difference = Math.abs(observed - recorded);

              return (
                <li
                  key={key}
                  className="rounded-md border border-[#cdd2d6] bg-white px-4
                    py-3"
                >
                  <div
                    className="flex flex-wrap items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-semibold text-[#04151f]">
                        <ItemLabel label={holding.batch_id} /> —{" "}
                        {holdingName(holding)}
                      </p>
                      <p className="text-sm text-[#6d635d]">
                        Recorded {recordedQuantity(holding)} · Observed{" "}
                        {observed} {holding.unit}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-sm
                      font-semibold ${classificationClasses(classification)}`}
                    >
                      {classification}
                      {difference > 0 ? ` · ${difference} ${holding.unit}` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
            {unexpectedCounts.map(({ batchId, observed }) => (
              <li
                key={batchId}
                className="rounded-md border border-violet-300 bg-violet-50 px-4
                  py-3"
              >
                <div
                  className="flex flex-wrap items-start justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold text-[#04151f]">
                      <ItemLabel label={batchId} />
                    </p>
                    <p className="text-sm text-[#6d635d]">
                      Recorded 0 · Observed {observed}
                    </p>
                  </div>
                  <span
                    className="rounded-full border border-violet-300 bg-white
                      px-2.5 py-1 text-sm font-semibold text-violet-900"
                  >
                    Unexpected · {observed}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {unresolvedEvidence.length > 0 && (
            <section
              aria-labelledby="audit-unresolved-title"
              className="mb-6 rounded-md border border-amber-300 bg-amber-50
                px-4 py-4 text-amber-950"
            >
              <h3 id="audit-unresolved-title" className="font-bold">
                {hasPendingUnexpectedSelection
                  ? "Uncounted known batch evidence"
                  : "Unresolved physical evidence"}
              </h3>
              <p className="mt-1 text-sm">
                {hasPendingUnexpectedSelection ? (
                  <>
                    These values identified{" "}
                    <ItemLabel label={selectedBatchId} />, but no positive
                    quantity was added. Recording will preserve the values as
                    unresolved evidence, not as a batch count.
                  </>
                ) : (
                  <>
                    These values did not identify a known batch. Recording will
                    preserve them with this count.
                  </>
                )}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {unresolvedEvidence.map((value, index) => (
                  <li key={`${value}-${index}`}>
                    <code>{value}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={recording}
              onClick={() => setPhase("counting")}
              className="rounded-md border border-[#26532b] bg-white px-5 py-3
                font-semibold text-[#26532b] hover:bg-green-50
                disabled:cursor-wait disabled:opacity-60"
            >
              Back to counting
            </button>
            <button
              type="button"
              disabled={recording}
              onClick={() => void recordCount()}
              className={`${submitClasses} sm:w-auto sm:min-w-52`}
            >
              {recording ? "Recording evidence…" : "Record physical evidence"}
            </button>
          </div>
        </section>
      )}

      {state && phase !== "review" && phase !== "recorded" && (
        <section aria-labelledby="audit-count-title">
          <h2
            id="audit-count-title"
            className="text-xl font-bold text-[#04151f] mb-2"
          >
            Count <ItemLabel label={state.location_id} />
          </h2>
          <p className="text-sm text-[#6d635d] mb-5">
            Enter what is physically present. A blank count is unknown, not
            zero.
          </p>

          {phase === "stale" && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-amber-400 bg-amber-50
                px-4 py-3 text-amber-950"
            >
              <p className="font-bold">
                Recorded inventory changed while you were counting.
              </p>
              <p className="mt-1 text-sm">
                Your entered counts and unresolved evidence are still retained
                below, but they cannot be compared with the stale snapshot.
              </p>
              <button
                type="button"
                onClick={() => void loadSnapshot(state.location_id)}
                className="mt-3 rounded-md bg-amber-900 px-4 py-2 font-semibold
                  text-white hover:bg-amber-950"
              >
                Load current inventory and start a new count
              </button>
            </div>
          )}

          {state.blockers.length > 0 && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-amber-400 bg-amber-50
                px-4 py-3 text-amber-950"
            >
              <p className="font-bold">
                This bin cannot be reviewed safely yet.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.blockers.map((blocker, index) => (
                  <li key={`${blocker.type}-${index}`}>
                    {blockerDescription(blocker)}{" "}
                    <code className="text-xs">({blocker.type})</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expectedHoldings.length === 0 && state.blockers.length === 0 && (
            <div
              className="mb-5 rounded-md border border-amber-300 bg-amber-50
                px-4 py-3 text-amber-950"
            >
              <p className="font-semibold">
                No positive holdings are recorded.
              </p>
              <p className="mt-1 text-sm">
                This screen will not silently certify an uncounted bin as empty.
                If anything is physically present,{" "}
                <Link className="font-semibold underline" to={captureHref}>
                  Quick Capture it into this bin
                </Link>
                , or identify a known unexpected batch below.
              </p>
            </div>
          )}

          {expectedHoldings.length > 0 && (
            <ol className="space-y-4 mb-8">
              {expectedHoldings.map((holding, index) => {
                const key = holdingKey(holding, index);
                const inputId = `audit-observed-${index}`;
                const observed = observedCounts[key] ?? "";
                const recorded = wholeNumber(holding.quantity);

                return (
                  <li
                    key={key}
                    className="rounded-md border border-[#cdd2d6] bg-white px-4
                      py-4 shadow-sm"
                  >
                    <div className="mb-3">
                      <p className="font-semibold text-[#04151f]">
                        <ItemLabel label={holding.batch_id} /> —{" "}
                        {holdingName(holding)}
                      </p>
                      <p className="text-sm text-[#6d635d]">
                        {holding.sku_id ? (
                          <>
                            SKU <ItemLabel label={holding.sku_id} />
                            {holding.sku_name
                              ? ` — ${holding.sku_name}`
                              : " — Unnamed SKU"}
                            {" · "}
                          </>
                        ) : (
                          <>No SKU · </>
                        )}
                        Recorded <strong>{recordedQuantity(holding)}</strong>
                        {holding.packaging_configuration_id
                          ? ` · Package ${holding.packaging_configuration_id}`
                          : ""}
                      </p>
                    </div>

                    <div
                      className="grid gap-3 sm:grid-cols-[1fr_auto]
                        sm:items-end"
                    >
                      <div>
                        <label htmlFor={inputId} className={labelClasses}>
                          Observed quantity
                        </label>
                        <input
                          id={inputId}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={observed}
                          onChange={(event) =>
                            setObservedCounts((counts) => ({
                              ...counts,
                              [key]: event.target.value,
                            }))
                          }
                          aria-describedby={`${inputId}-status`}
                          className={inputClasses}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={recorded === null}
                        onClick={() =>
                          setObservedCounts((counts) => ({
                            ...counts,
                            [key]: String(recorded),
                          }))
                        }
                        className="rounded-md border border-[#26532b] bg-white
                          px-4 py-3 font-semibold text-[#26532b]
                          hover:bg-green-50 disabled:cursor-not-allowed
                          disabled:opacity-50"
                      >
                        Matches recorded
                      </button>
                    </div>
                    <p
                      id={`${inputId}-status`}
                      className="mt-2 text-sm font-semibold"
                      aria-live="polite"
                    >
                      <CountingStatus holding={holding} observed={observed} />
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          <section
            aria-labelledby="unexpected-batch-title"
            className="mb-7 border-t border-[#cdd2d6] pt-6"
          >
            <h3
              id="unexpected-batch-title"
              className="text-lg font-bold text-[#04151f] mb-1"
            >
              Found something else?
            </h3>
            <p className="text-sm text-[#6d635d] mb-4">
              Scan or search for a known batch. Identifying it does not add to
              the count; you must enter the observed quantity explicitly.
            </p>

            <InventoryBatchSelector
              id="audit-unexpected-evidence"
              evidence={itemEvidence}
              setEvidence={setItemEvidence}
              selectedBatchId={selectedBatchId}
              setSelectedBatchId={setSelectedBatchId}
              unknownAction={
                <Link className="font-semibold underline" to={captureHref}>
                  Use Quick Capture for an unknown item.
                </Link>
              }
            />

            {selectedBatchId && selectedIsExpected && (
              <p
                role="status"
                className="mb-4 rounded-md border border-blue-300 bg-blue-50
                  px-3 py-2 text-sm text-blue-900"
              >
                <ItemLabel label={selectedBatchId} /> is already expected here.
                Enter its observed quantity in the recorded list above.
              </p>
            )}

            {selectedBatchId && selectedIsAlreadyUnexpected && (
              <p
                role="status"
                className="mb-4 rounded-md border border-blue-300 bg-blue-50
                  px-3 py-2 text-sm text-blue-900"
              >
                <ItemLabel label={selectedBatchId} /> is already in the
                unexpected list below. Edit that explicit count instead.
              </p>
            )}

            {selectedBatchId &&
              !selectedIsExpected &&
              !selectedIsAlreadyUnexpected && (
              <div
                className="mb-5 rounded-md border border-violet-300
                    bg-violet-50 p-4"
              >
                <p className="mb-3 font-semibold text-violet-950">
                  <ItemLabel label={selectedBatchId} /> is not recorded in
                    this bin.
                </p>
                <div
                  className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                >
                  <div>
                    <label
                      htmlFor="audit-unexpected-quantity"
                      className={labelClasses}
                    >
                        Observed quantity
                    </label>
                    <input
                      id="audit-unexpected-quantity"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={pendingUnexpectedCount}
                      onChange={(event) =>
                        setPendingUnexpectedCount(event.target.value)
                      }
                      className={inputClasses}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      !isExplicitWholeNumber(pendingUnexpectedCount, 1)
                    }
                    onClick={addUnexpected}
                    className="rounded-md bg-violet-800 px-4 py-3
                        font-semibold text-white hover:bg-violet-900
                        disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      Add explicit count
                  </button>
                </div>
              </div>
            )}

            {unexpectedCounts.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-[#04151f]">
                  Unexpected batches
                </h4>
                {unexpectedCounts.map(({ batchId, observed }) => (
                  <div
                    key={batchId}
                    className="grid gap-3 rounded-md border border-violet-300
                      bg-violet-50 p-3 sm:grid-cols-[1fr_9rem_auto]
                      sm:items-end"
                  >
                    <p className="font-semibold text-violet-950">
                      <ItemLabel label={batchId} />
                      <span className="block text-sm font-normal">
                        Recorded 0
                      </span>
                    </p>
                    <div>
                      <label
                        htmlFor={`audit-unexpected-${batchId}`}
                        className={labelClasses}
                      >
                        Observed
                      </label>
                      <input
                        id={`audit-unexpected-${batchId}`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={observed}
                        onChange={(event) =>
                          setUnexpectedCounts((counts) =>
                            counts.map((count) =>
                              count.batchId === batchId
                                ? { ...count, observed: event.target.value }
                                : count,
                            ),
                          )
                        }
                        className={inputClasses}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUnexpectedCounts((counts) =>
                          counts.filter((count) => count.batchId !== batchId),
                        )
                      }
                      className="rounded-md border border-violet-700 bg-white
                        px-3 py-2 font-semibold text-violet-900
                        hover:bg-violet-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!everyExpectedCounted && expectedHoldings.length > 0 && (
            <p className="mb-3 text-sm font-semibold text-[#6d635d]">
              Count every recorded holding explicitly before review. Use zero
              only when an expected batch is physically missing.
            </p>
          )}
          {isBlocked && (
            <p className="mb-3 text-sm font-semibold text-amber-900">
              Review is unavailable until the recorded inventory blockers are
              resolved.
            </p>
          )}
          {!hasPhysicalEvidence && !isBlocked && (
            <p className="mb-3 text-sm font-semibold text-[#6d635d]">
              There is nothing explicit to compare yet.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={!canReview || reviewing}
              onClick={() => void reviewCounts()}
              className={`${submitClasses} sm:w-auto sm:min-w-44`}
            >
              {reviewing ? "Checking snapshot…" : "Review counts"}
            </button>
            <button
              type="button"
              onClick={startAnotherBin}
              className="rounded-md border border-[#26532b] bg-white px-5 py-3
                font-semibold text-[#26532b] hover:bg-green-50"
            >
              Start another bin
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
