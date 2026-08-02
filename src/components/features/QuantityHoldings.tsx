import * as React from "react";
import { useContext, useState } from "react";
import { useFrontload } from "react-frontload";

import { ApiContext, FrontloadContext } from "../../api-client/api-client";
import {
  QuantityHoldingResource,
  QuantityHoldingsResult,
} from "../../api-client/data-models";
import ItemLabel from "../primitives/ItemLabel";
import { ToastContext } from "../primitives/Toast";
import { useAuth } from "../auth/AuthContext";
import {
  inputClasses,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

function rangeLabel(holding: QuantityHoldingResource): string {
  const physical = holding.feasible_physical;
  if (physical.status === "conflict") return "Conflicting quantity evidence";
  if (physical.status === "indeterminate") return "Quantity could not be calculated";
  const range =
    physical.minimum != null &&
    physical.maximum != null &&
    String(physical.minimum) === String(physical.maximum)
      ? `${physical.minimum} ${physical.unit}`
      : `${physical.minimum ?? "?"}–${physical.maximum ?? "?"} ${physical.unit}`;
  return physical.preferred == null
    ? range
    : `${range} (best estimate ${physical.preferred})`;
}

function QuantityHoldingCard({
  holding,
  onUpdate,
}: {
  holding: QuantityHoldingResource;
  onUpdate: (holding: QuantityHoldingResource) => void;
}) {
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const { hasOperation } = useAuth();
  const observationIdempotency = useCommandIdempotency();
  const withdrawalIdempotency = useCommandIdempotency();
  const [observationMode, setObservationMode] = useState<"counted" | "estimated">("counted");
  const [observationAmount, setObservationAmount] = useState("");
  const [supersedesFactId, setSupersedesFactId] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const identity = holding.holding;
  const canObserve = hasOperation("quantity-observation");
  const canWithdraw = hasOperation("quantity-withdrawal");

  const recordObservation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const amount = Number(observationAmount);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      (holding.feasible_physical.domain === "discrete" && !Number.isInteger(amount))
    ) {
      setError("Enter a valid nonnegative quantity in this holding's unit.");
      return;
    }
    const claim =
      observationMode === "counted"
        ? {
            domain: holding.feasible_physical.domain,
            basis: "counted" as const,
            lower: observationAmount,
            preferred: observationAmount,
            upper: observationAmount,
          }
        : {
            domain: holding.feasible_physical.domain,
            basis: "estimated" as const,
            preferred: observationAmount,
          };
    const command = {
      ...identity,
      packaging_configuration_id: null,
      domain: holding.feasible_physical.domain,
      claim,
      ...(supersedesFactId ? { supersedes_fact_id: supersedesFactId } : {}),
    };
    setSubmitting(true);
    try {
      const response = await api.postQuantityObservation(
        command,
        observationIdempotency.keyFor(command),
      );
      if (response.kind === "problem") {
        setError(response.title);
        return;
      }
      onUpdate(response.state.holding);
      observationIdempotency.clear();
      setObservationAmount("");
      setSupersedesFactId("");
      setToastContent({
        content: <p>Physical quantity evidence recorded.</p>,
        mode: response.state.holding.feasible_physical.status === "conflict"
          ? "failure"
          : "success",
      });
    } catch {
      setError("The observation could not be recorded. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const recordWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const amount = Number(withdrawalAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (holding.feasible_physical.domain === "discrete" && !Number.isInteger(amount))
    ) {
      setError("Enter a positive amount used in this holding's unit.");
      return;
    }
    const command = {
      ...identity,
      packaging_configuration_id: null,
      domain: holding.feasible_physical.domain,
      amount: withdrawalAmount,
    };
    setSubmitting(true);
    try {
      const response = await api.postQuantityWithdrawal(
        command,
        withdrawalIdempotency.keyFor(command),
      );
      if (response.kind === "problem") {
        setError(response.title);
        return;
      }
      onUpdate(response.state.holding);
      withdrawalIdempotency.clear();
      setWithdrawalAmount("");
      setToastContent({
        content: <p>Known use recorded without inventing its starting quantity.</p>,
        mode: "success",
      });
    } catch {
      setError("The withdrawal could not be recorded. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="rounded-md border border-[#cdd2d6] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <ItemLabel label={identity.location_id} />
          <span className="ml-2 font-semibold text-[#04151f]">{rangeLabel(holding)}</span>
        </div>
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
          Physical quantity — not available inventory
        </span>
      </div>

      {holding.feasible_physical.capacity != null && (
        <p className="mt-2 text-sm text-[#6d635d]">
          Capacity: {holding.feasible_physical.capacity} {identity.unit}
        </p>
      )}
      {holding.feasible_physical.status === "conflict" && (
        <div role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          The retained observations cannot all describe one physical history.
          Nothing was deleted. Check the item, then replace the specific bad
          claim while recording a corrected count or estimate.
        </div>
      )}
      {error && <div role="alert" className="mt-3 text-sm text-red-700">{error}</div>}

      {(canObserve || canWithdraw) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {canObserve && (
            <details className="rounded border border-[#d7dcdf] p-3">
              <summary className="cursor-pointer font-semibold">Count or re-estimate</summary>
              <form onSubmit={recordObservation} className="mt-3">
                <label htmlFor={`observation-mode-${holding.stream_id}`} className={labelClasses}>Evidence</label>
                <select
                  id={`observation-mode-${holding.stream_id}`}
                  value={observationMode}
                  onChange={(event) => setObservationMode(event.target.value as "counted" | "estimated")}
                  className={`${inputClasses} mb-3`}
                >
                  <option value="counted">Counted exactly</option>
                  <option value="estimated">New estimate</option>
                </select>
                <label htmlFor={`observation-${holding.stream_id}`} className={labelClasses}>Quantity ({identity.unit})</label>
                <input
                  id={`observation-${holding.stream_id}`}
                  type="number"
                  min="0"
                  step={holding.feasible_physical.domain === "discrete" ? "1" : "any"}
                  value={observationAmount}
                  onChange={(event) => setObservationAmount(event.target.value)}
                  className={`${inputClasses} mb-3`}
                />
                <label htmlFor={`supersedes-${holding.stream_id}`} className={labelClasses}>
                  Replace an earlier bad claim (optional)
                </label>
                <select
                  id={`supersedes-${holding.stream_id}`}
                  value={supersedesFactId}
                  onChange={(event) => setSupersedesFactId(event.target.value)}
                  className={`${inputClasses} mb-3`}
                >
                  <option value="">Keep all earlier evidence</option>
                  {holding.history
                    .filter((item) => item.active && item.kind !== "withdrawal")
                    .map((item) => (
                      <option key={item.fact_id} value={item.fact_id}>
                        {item.kind === "opening" ? "Opening estimate" : "Observation"}
                        {item.claim
                          ? `: ${item.claim.lower ?? "?"}–${item.claim.upper ?? "?"}`
                          : ""}
                      </option>
                    ))}
                </select>
                <button type="submit" disabled={submitting} className={submitClasses}>Record evidence</button>
              </form>
            </details>
          )}
          {canWithdraw && (
            <details className="rounded border border-[#d7dcdf] p-3">
              <summary className="cursor-pointer font-semibold">Record known use</summary>
              <form onSubmit={recordWithdrawal} className="mt-3">
                <label htmlFor={`withdrawal-${holding.stream_id}`} className={labelClasses}>Amount used ({identity.unit})</label>
                <input
                  id={`withdrawal-${holding.stream_id}`}
                  type="number"
                  min="0"
                  step={holding.feasible_physical.domain === "discrete" ? "1" : "any"}
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  className={`${inputClasses} mb-3`}
                />
                <button type="submit" disabled={submitting} className={submitClasses}>Record use</button>
              </form>
            </details>
          )}
        </div>
      )}

      <details className="mt-4 text-sm text-[#5f6468]">
        <summary className="cursor-pointer">Retained history ({holding.history.length})</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {[...holding.history].reverse().map((item) => (
            <li key={item.fact_id} className={item.active ? "" : "line-through opacity-60"}>
              {item.kind === "withdrawal"
                ? `Used ${item.amount} ${identity.unit}`
                : `${item.claim?.basis ?? "quantity"}: ${item.claim?.lower ?? "?"}–${item.claim?.upper ?? "?"} ${identity.unit}`}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

export default function QuantityHoldings({
  batchId,
  locationId,
}: {
  batchId?: string;
  locationId?: string;
}) {
  const { data, frontloadMeta, setData } = useFrontload(
    `quantity-holdings-${batchId ?? ""}-${locationId ?? ""}`,
    async ({ api }: FrontloadContext) => ({
      quantityHoldings: await api.getQuantityHoldings({ batchId, locationId }),
    }),
  );

  if (frontloadMeta.pending) return <p className="text-sm text-[#6d635d]">Loading physical estimates…</p>;
  if (frontloadMeta.error || data.quantityHoldings.kind === "problem") {
    return <p className="text-sm text-red-700">Physical quantity evidence could not be loaded.</p>;
  }
  const result = data.quantityHoldings as QuantityHoldingsResult;
  if (!result.state.holdings.length) {
    return <p className="text-sm italic text-[#6d635d]">No uncertain physical quantities.</p>;
  }

  const update = (updated: QuantityHoldingResource) => {
    setData(() => ({
      quantityHoldings: {
        ...result,
        state: {
          holdings: result.state.holdings.map((holding) =>
            holding.stream_id === updated.stream_id ? updated : holding
          ),
        },
      },
    }));
  };

  return (
    <div className="space-y-3">
      {result.state.holdings.map((holding) => (
        <QuantityHoldingCard key={holding.stream_id} holding={holding} onUpdate={update} />
      ))}
    </div>
  );
}
