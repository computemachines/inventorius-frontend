import * as React from "react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  InventoryCandidate,
  InventoryCandidateMatch,
  InventoryCandidatesResult,
  InventorySkuCandidate,
} from "../../api-client/data-models";
import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";
import { isBinId, labelClasses } from "../features/inventory-operation-form";
import CodesInput, { Code } from "./CodesInput";

const emptyEvidence: Code = { value: "", kind: "associated" };

function resolverEvidence(codes: Code[]): string[] {
  return codes.filter((code) => code.value.trim()).map((code) => code.value);
}

function matchLabel(match: InventoryCandidateMatch): string {
  const scope = match.scope === "sku" ? "SKU" : "batch";
  if (match.kind === "batch-id") return "batch label";
  if (match.kind === "sku-id") return "SKU label";
  if (match.kind === "text") {
    if (match.relationship === "identity") return `${scope} label text`;
    if (match.relationship === "name") return `${scope} description`;
    if (match.relationship === "observed") return "observed code fragment";
    return `${scope} ${match.relationship} code fragment`;
  }
  if (match.relationship === "observed") return "observed barcode";
  return `${scope} ${match.relationship} code`;
}

function candidateName(candidate: {
  batch_name: string | null;
  sku_name: string | null;
}): string | null {
  return candidate.batch_name || candidate.sku_name;
}

function CandidateDetails({ candidate }: { candidate: InventoryCandidate }) {
  const matchLabels = Array.from(new Set(candidate.matches.map(matchLabel)));
  return (
    <span className="min-w-0">
      <span className="block font-semibold text-[#04151f]">
        {candidate.batch_id}
        {candidateName(candidate) ? ` — ${candidateName(candidate)}` : ""}
      </span>
      <span className="block text-sm text-[#6d635d]">
        {candidate.sku_id ? `${candidate.sku_id} · ` : ""}
        {candidate.available_quantity != null
          ? `${candidate.available_quantity} available · `
          : ""}
        Matched by {matchLabels.join(", ")}
      </span>
    </span>
  );
}

function SkuCandidateDetails({ candidate }: { candidate: InventorySkuCandidate }) {
  const matchLabels = Array.from(new Set(candidate.matches.map(matchLabel)));
  return (
    <span className="min-w-0">
      <span className="block font-semibold text-[#04151f]">
        {candidate.sku_id}
        {candidate.sku_name ? ` — ${candidate.sku_name}` : ""}
      </span>
      <span className="block text-sm text-[#6d635d]">
        Matched by {matchLabels.join(", ")}
      </span>
    </span>
  );
}

interface InventoryBatchSelectorBaseProps {
  id: string;
  /** Omit for context-free resolution, such as receiving new inventory. */
  sourceLocationId?: string;
  evidence: Code[];
  setEvidence: (evidence: Code[]) => void;
  selectedBatchId: string;
  setSelectedBatchId: (batchId: string) => void;
  /** Enables an explicit "new batch under this SKU" choice when supplied. */
  selectedSkuId?: string;
  setSelectedSkuId?: (skuId: string) => void;
  /** Receive supplies its Quick Capture route here for an unknown item. */
  unknownAction?: React.ReactNode;
  firstInputRef?: React.Ref<HTMLInputElement>;
}

export type InventoryBatchSelectorProps = InventoryBatchSelectorBaseProps &
  (
    | {
        observedEvidence?: undefined;
        setObservedEvidence?: undefined;
      }
    | {
        /** Explicit physical marks to persist with a successful receipt. */
        observedEvidence: Code[];
        setObservedEvidence: (evidence: Code[]) => void;
      }
  );

/**
 * Resolves scanner evidence to an operation-ready holding in one source bin.
 *
 * Identity-strength evidence may select exactly one result automatically.
 * Text matches and ownership conflicts always require an ordinary radio-button
 * confirmation, even if only one candidate currently remains.
 */
export default function InventoryBatchSelector({
  id,
  sourceLocationId,
  evidence,
  setEvidence,
  selectedBatchId,
  setSelectedBatchId,
  selectedSkuId,
  setSelectedSkuId,
  observedEvidence,
  setObservedEvidence,
  unknownAction,
  firstInputRef,
}: InventoryBatchSelectorProps) {
  const api = useContext(ApiContext);
  const [result, setResult] = useState<InventoryCandidatesResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [retryGeneration, setRetryGeneration] = useState(0);
  const generation = useRef(0);

  // Blank rows are a scanner affordance. They do not become resolver terms,
  // and nonblank evidence is sent byte-for-byte rather than ID-normalized.
  const hasExplicitObservedEvidence =
    observedEvidence !== undefined && setObservedEvidence !== undefined;
  const evidenceValues = useMemo(
    () => [
      ...resolverEvidence(evidence),
      ...resolverEvidence(observedEvidence ?? []),
    ],
    [evidence, observedEvidence],
  );
  const evidenceSignature = JSON.stringify(evidenceValues);
  const sourceIsRequired = sourceLocationId !== undefined;
  const canonicalSourceId = normalizeInventoriusId(sourceLocationId ?? "");
  const sourceIsValid = !sourceIsRequired || isBinId(canonicalSourceId);
  const supportsSkuSelection = setSelectedSkuId !== undefined;

  useEffect(() => {
    const thisGeneration = ++generation.current;
    const controller = new AbortController();
    const values: string[] = JSON.parse(evidenceSignature);

    setSelectedBatchId("");
    setSelectedSkuId?.("");
    setResult(null);
    setRequestError("");

    if (!sourceIsValid || values.length === 0) {
      setResolving(false);
      return () => controller.abort();
    }

    setResolving(true);
    const timer = globalThis.setTimeout(async () => {
      try {
        const response = await api.getInventoryCandidates({
          evidence: values,
          sourceLocationId: sourceIsRequired ? canonicalSourceId : undefined,
          signal: controller.signal,
        });
        if (generation.current !== thisGeneration) return;

        setResolving(false);
        if (response.kind === "problem") {
          setRequestError(response.title);
          return;
        }

        setResult(response);
        if (
          response.state.status === "identified" &&
          response.state.resolution === "unique" &&
          response.state.results.length === 1
        ) {
          // Deliberately do not focus anything here. A scanner may already
          // have used Tab to move on while this request was in flight.
          setSelectedBatchId(response.state.results[0].batch_id);
          setSelectedSkuId?.("");
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        if (generation.current !== thisGeneration) return;
        setResolving(false);
        setRequestError(
          "Could not resolve this item. Check the API and retry.",
        );
      }
    }, 120);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [
    api,
    canonicalSourceId,
    evidenceSignature,
    retryGeneration,
    sourceIsValid,
    sourceIsRequired,
    setSelectedBatchId,
    setSelectedSkuId,
  ]);

  const state = result?.state;
  const requiresChoice =
    state &&
    state.results.length > 0 &&
    (state.status !== "identified" || state.resolution !== "unique");
  const hasEvidenceConflict = state?.conflicts.some(
    (conflict) => conflict.kind === "evidence-conflict",
  );
  const hasOwnershipConflict = state?.conflicts.some(
    (conflict) => conflict.kind === "duplicate-owned-code",
  );
  const skuCandidates = state?.sku_candidates;
  const hasSkuChoices =
    supportsSkuSelection && (skuCandidates?.results.length ?? 0) > 0;
  const hasSkuConflict = skuCandidates?.conflicts.some(
    (conflict) => conflict.kind === "sku-evidence-conflict",
  );

  return (
    <div className="mb-5">
      <label htmlFor={id} className={labelClasses}>
        Item
      </label>
      <CodesInput
        id={id}
        firstInputRef={firstInputRef}
        inputLabel="Additional item evidence"
        spellCheck
        codes={evidence.length ? evidence : [emptyEvidence]}
        setCodes={(nextEvidence) => {
          const nextSignature = JSON.stringify([
            ...resolverEvidence(nextEvidence),
            ...resolverEvidence(observedEvidence ?? []),
          ]);
          if (nextSignature !== evidenceSignature) {
            setSelectedBatchId("");
            setSelectedSkuId?.("");
          }
          setEvidence(nextEvidence);
        }}
        showRelationshipControls={false}
        allowMultiple={!hasExplicitObservedEvidence}
      />
      <p className="mt-1.5 text-sm text-[#6d635d]">
        {hasExplicitObservedEvidence
          ? "Scan a known label or code, or type a description to find the item."
          : "Scan a batch label or barcode, or type a description. Additional scans narrow the candidates."}
      </p>

      {hasExplicitObservedEvidence && (
        <div className="mt-4">
          <label htmlFor={`${id}-observed`} className={labelClasses}>
            Observed codes on this receipt (optional)
          </label>
          <CodesInput
            id={`${id}-observed`}
            inputLabel="Additional observed code on this receipt"
            codes={observedEvidence}
            setCodes={(nextEvidence) => {
              const nextSignature = JSON.stringify([
                ...resolverEvidence(evidence),
                ...resolverEvidence(nextEvidence),
              ]);
              if (nextSignature !== evidenceSignature) {
                setSelectedBatchId("");
                setSelectedSkuId?.("");
              }
              setObservedEvidence(nextEvidence);
            }}
            showRelationshipControls={false}
          />
          <p className="mt-1.5 text-sm text-[#6d635d]">
            These physical marks will be remembered with the receipt and also
            narrow the candidates.
          </p>
        </div>
      )}

      <div
        className="mt-3"
        aria-live="polite"
        data-resolution={state?.resolution}
      >
        {evidenceValues.length > 0 && sourceIsRequired && !sourceIsValid && (
          <p className="text-sm text-[#6d635d]">
            Enter a valid source bin to resolve this item.
          </p>
        )}

        {resolving && (
          <p role="status" className="text-sm text-[#6d635d]">
            Resolving item…
          </p>
        )}

        {requestError && (
          <div role="alert" className="text-sm text-red-700">
            <p>{requestError}</p>
            <button
              type="button"
              className="mt-1 font-semibold underline"
              onClick={() => setRetryGeneration((generation) => generation + 1)}
            >
              Retry lookup
            </button>
          </div>
        )}

        {state?.status === "identified" && state.results.length === 1 && (
          supportsSkuSelection ? (
            <label
              className="flex cursor-pointer items-start gap-2 rounded-md border
                border-green-300 bg-green-50 px-3 py-2"
            >
              <input
                type="radio"
                name={`${id}-candidate`}
                value={state.results[0].batch_id}
                checked={selectedBatchId === state.results[0].batch_id}
                onChange={() => {
                  setSelectedBatchId(state.results[0].batch_id);
                  setSelectedSkuId?.("");
                }}
                className="mt-1"
              />
              <span className="min-w-0">
                <span
                  className="block text-xs font-semibold uppercase tracking-wide
                    text-green-800"
                >
                  Existing batch identified
                </span>
                <CandidateDetails candidate={state.results[0]} />
              </span>
            </label>
          ) : (
            <div
              role="status"
              className="rounded-md border border-green-300 bg-green-50 px-3 py-2"
            >
              <span
                className="block text-xs font-semibold uppercase tracking-wide
                  text-green-800"
              >
                Identified
              </span>
              <CandidateDetails candidate={state.results[0]} />
            </div>
          )
        )}

        {(hasEvidenceConflict || hasOwnershipConflict) && (
          <div
            role="alert"
            className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3
              py-2 text-sm text-amber-900"
          >
            {hasEvidenceConflict && (
              <p>
                These scans identify incompatible items. Remove or replace the
                incorrect scan.
              </p>
            )}
            {hasOwnershipConflict && (
              <p>
                A code has conflicting ownership claims. Choose the physical
                item it actually belongs to; the code relationship can be
                reconciled separately.
              </p>
            )}
          </div>
        )}

        {requiresChoice && (
          <fieldset
            className="rounded-md border border-[#cdd2d6] bg-white px-3 py-2"
          >
            <legend className="px-1 text-sm font-semibold text-[#04151f]">
              {state.resolution === "ambiguous"
                ? "Choose the matching batch"
                : "Confirm the matching batch"}
            </legend>
            <div className="space-y-2">
              {state.results.map((candidate) => (
                <label
                  key={candidate.batch_id}
                  className="flex cursor-pointer items-start gap-2 rounded px-2
                    py-2 hover:bg-[#f2f0ea]"
                >
                  <input
                    type="radio"
                    name={`${id}-candidate`}
                    value={candidate.batch_id}
                    checked={selectedBatchId === candidate.batch_id}
                    onChange={() => {
                      setSelectedBatchId(candidate.batch_id);
                      setSelectedSkuId?.("");
                    }}
                    className="mt-1"
                  />
                  <CandidateDetails candidate={candidate} />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {hasSkuConflict && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3
              py-2 text-sm text-amber-900"
          >
            The scans identify incompatible SKUs. Remove or replace the
            incorrect scan before creating a new batch.
          </div>
        )}

        {hasSkuChoices && !hasSkuConflict && (
          <fieldset
            className="mt-3 rounded-md border border-[#cdd2d6] bg-white px-3 py-2"
          >
            <legend className="px-1 text-sm font-semibold text-[#04151f]">
              Create a new batch under this SKU
            </legend>
            <p className="mb-2 text-sm text-[#6d635d]">
              Choose this when the arriving stock is a distinct delivery or
              lot, rather than more of a listed batch.
            </p>
            <div className="space-y-2">
              {skuCandidates?.results.map((candidate) => (
                <label
                  key={candidate.sku_id}
                  className="flex cursor-pointer items-start gap-2 rounded px-2
                    py-2 hover:bg-[#f2f0ea]"
                >
                  <input
                    type="radio"
                    name={`${id}-candidate`}
                    value={`new-batch-${candidate.sku_id}`}
                    checked={selectedSkuId === candidate.sku_id}
                    onChange={() => {
                      setSelectedSkuId?.(candidate.sku_id);
                      setSelectedBatchId("");
                    }}
                    className="mt-1"
                  />
                  <SkuCandidateDetails candidate={candidate} />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {state?.truncated && (
          <p className="mt-2 text-sm text-[#6d635d]">
            Showing the first {state.returned_num_results} of{" "}
            {state.total_num_results}; scan or type more to narrow.
          </p>
        )}

        {state?.status === "unknown" &&
          state.resolution === "none" &&
          state.context_mismatches.length === 0 &&
          !hasSkuChoices && (
            <p className="text-sm text-[#6d635d]">
              {sourceIsRequired
                ? `No matching operation-ready inventory is in ${canonicalSourceId}.`
                : "No matching batch or SKU was found."} {unknownAction}
            </p>
          )}

        {state?.context_mismatches.length > 0 && (
          <div
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2
              text-sm text-amber-900"
          >
            {state.context_mismatches.map((mismatch) => (
              <p key={`${mismatch.batch_id}-${mismatch.reason}`}>
                {mismatch.batch_id}
                {candidateName(mismatch)
                  ? ` — ${candidateName(mismatch)}`
                  : ""}{" "}
                {mismatch.reason === "not-at-location"
                  ? `is known, but is not available in ${canonicalSourceId}.`
                  : "is present in a unit or package this operation cannot handle yet."}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
