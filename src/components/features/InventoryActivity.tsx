import * as React from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { useFrontload } from "react-frontload";
import { Link, useParams } from "react-router-dom";

import {
  ApiClient,
  ApiContext,
  FrontloadContext,
} from "../../api-client/api-client";
import {
  InventoryOperationReceipt,
  InventoryReceiptQuantity,
  Problem,
} from "../../api-client/data-models";
import { normalizeInventoriusId } from "../../identifiers";
import ItemLabel from "../primitives/ItemLabel";
import ReceiptTime from "../primitives/ReceiptTime";
import {
  inputClasses,
  isBinId,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

function quantityText(quantity: InventoryReceiptQuantity | undefined): string {
  return quantity == null ? "Unknown" : String(quantity);
}

function receiptBatchId(receipt: InventoryOperationReceipt): string | null {
  return receipt.result.batch_id ?? receipt.legs[0]?.batch_id ?? null;
}

function receiptLocationId(receipt: InventoryOperationReceipt): string | null {
  return (
    receipt.result.location_id ??
    receipt.result.bin_id ??
    receipt.legs.find((leg) => !String(leg.quantity).startsWith("-"))
      ?.location_id ??
    receipt.legs[0]?.location_id ??
    null
  );
}

function receiptQuantity(
  receipt: InventoryOperationReceipt,
): InventoryReceiptQuantity | undefined {
  return (
    receipt.result.quantity ??
    receipt.legs.find((leg) => !String(leg.quantity).startsWith("-"))?.quantity
  );
}

function receiptUnit(receipt: InventoryOperationReceipt): string {
  return receipt.result.unit ?? receipt.legs[0]?.unit ?? "each";
}

function isIntake(receipt: InventoryOperationReceipt): boolean {
  return typeof receipt.result.created_sku === "boolean";
}

function receiptKindLabel(receipt: InventoryOperationReceipt): string {
  if (receipt.kind === "receive") {
    return isIntake(receipt) ? "Intake" : "Receive";
  }
  if (receipt.kind === "correction") return "Correction";
  if (receipt.kind === "transfer") return "Move";
  if (receipt.kind === "release") return "Release";
  return receipt.kind;
}

function parseWholeQuantity(
  quantity: InventoryReceiptQuantity | undefined,
): bigint | null {
  const text = quantityText(quantity);
  if (!/^\d+$/.test(text)) return null;
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function formatBlocker(blocker: string | null): string {
  if (!blocker) {
    return "This kind of receipt cannot be corrected here.";
  }
  const known: Record<string, string> = {
    "already-corrected": "This receipt already has a correction.",
    "correction-target":
      "A correction receipt cannot itself be corrected with this form.",
    "malformed-history":
      "This older receipt is incomplete, so Inventorius will not guess how to correct it.",
    "unsupported-operation-kind":
      "Only a Receive or Intake receipt can be corrected here.",
    "unsupported-receipt-shape":
      "This receipt describes more than one holding and needs a different correction flow.",
    "unsupported-unit":
      "This receipt does not use a supported whole-item unit.",
    "packaged-holding":
      "Packaged inventory cannot be corrected with this form.",
    "unsupported-quantity":
      "This receipt does not contain a supported whole-item quantity.",
  };
  return known[blocker] ?? blocker;
}

function correctionProblemMessage(problem: Problem): string {
  const reason =
    problem.detail ?? (problem.blocker ? formatBlocker(problem.blocker) : null);
  return reason ? `${problem.title} ${reason}` : problem.title;
}

function ResourceIdentifier({ id }: { id: string | null | undefined }) {
  if (!id) return <span>Not recorded</span>;
  if (/^(BIN|SKU|BAT)\d{6}$/.test(id)) {
    return <ItemLabel label={id} />;
  }
  return <code className="break-all text-sm">{id}</code>;
}

function OperationLink({ operationId }: { operationId: string }) {
  return (
    <Link
      to={`/activity/${encodeURIComponent(operationId)}`}
      className="font-mono text-sm font-semibold text-[#26532b] underline
        decoration-[#26532b]/40 underline-offset-2 hover:decoration-[#26532b]"
    >
      {operationId}
    </Link>
  );
}

function RecordedSummary({ receipt }: { receipt: InventoryOperationReceipt }) {
  const batchId = receiptBatchId(receipt);
  const locationId = receiptLocationId(receipt);
  const quantity = receiptQuantity(receipt);
  const unit = receiptUnit(receipt);

  if (receipt.kind === "receive") {
    return (
      <p className="text-lg text-[#04151f]">
        {isIntake(receipt) ? "Intake recorded" : "Received"}{" "}
        <strong>{quantityText(quantity)}</strong> {unit} of{" "}
        <ResourceIdentifier id={batchId} /> into{" "}
        <ResourceIdentifier id={locationId} />.
      </p>
    );
  }

  if (receipt.kind === "correction") {
    const original = receipt.result.original_state;
    const intended = receipt.result.intended_state;
    if (original && intended) {
      return (
        <p className="text-lg text-[#04151f]">
          Corrected <ResourceIdentifier id={original.batch_id} /> from{" "}
          <strong>{quantityText(original.quantity)}</strong>{" "}
          {original.unit ?? "each"} into{" "}
          <ResourceIdentifier id={original.location_id} /> to{" "}
          <strong>{quantityText(intended.quantity)}</strong>{" "}
          {intended.unit ?? "each"} into{" "}
          <ResourceIdentifier id={intended.location_id} />.
        </p>
      );
    }
    return (
      <p className="text-lg text-[#04151f]">
        Recorded an immutable correction to a prior receipt.
      </p>
    );
  }

  if (receipt.kind === "transfer") {
    return (
      <p className="text-lg text-[#04151f]">
        Moved <strong>{quantityText(quantity)}</strong> {unit} of{" "}
        <ResourceIdentifier id={batchId} /> from{" "}
        <ResourceIdentifier id={receipt.result.source_location_id} /> to{" "}
        <ResourceIdentifier id={receipt.result.destination_location_id} />.
      </p>
    );
  }

  if (receipt.kind === "release") {
    return (
      <p className="text-lg text-[#04151f]">
        Released <strong>{quantityText(quantity)}</strong> {unit} of{" "}
        <ResourceIdentifier id={batchId} /> from{" "}
        <ResourceIdentifier id={locationId} />.
      </p>
    );
  }

  return <p className="text-lg text-[#04151f]">{receiptKindLabel(receipt)}</p>;
}

function CorrectionReceiptDetails({
  receipt,
}: {
  receipt: InventoryOperationReceipt;
}) {
  const original = receipt.result.original_state;
  const intended = receipt.result.intended_state;
  const batchId =
    original?.batch_id ?? intended?.batch_id ?? receiptBatchId(receipt);
  const batch = receipt.batches.find(({ batch_id }) => batch_id === batch_id);

  return (
    <section
      aria-labelledby="correction-details-heading"
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2
        id="correction-details-heading"
        className="mb-4 text-lg font-semibold text-[#04151f]"
      >
        Correction details
      </h2>

      <dl
        className="mb-5 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-3"
      >
        <dt className="font-medium text-[#6d635d]">Batch</dt>
        <dd>
          <ResourceIdentifier id={batchId} />
          {batch?.batch_name && (
            <span className="ml-2 text-[#6d635d]">{batch.batch_name}</span>
          )}
        </dd>
        {batch?.sku_id && (
          <>
            <dt className="font-medium text-[#6d635d]">SKU</dt>
            <dd>
              <ResourceIdentifier id={batch.sku_id} />
              {batch.sku_name && (
                <span className="ml-2 text-[#6d635d]">{batch.sku_name}</span>
              )}
            </dd>
          </>
        )}
      </dl>

      {original && intended ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <h3
              className="text-xs font-semibold uppercase tracking-wide
                text-[#6d635d]"
            >
              Recorded
            </h3>
            <p className="mt-1 font-semibold">
              {quantityText(original.quantity)} {original.unit ?? "each"} into{" "}
              <ResourceIdentifier id={original.location_id} />
            </p>
          </div>
          <span
            aria-hidden="true"
            className="hidden text-2xl text-[#6d635d] sm:block"
          >
            →
          </span>
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <h3
              className="text-xs font-semibold uppercase tracking-wide
                text-green-800"
            >
              Intended
            </h3>
            <p className="mt-1 font-semibold">
              {quantityText(intended.quantity)} {intended.unit ?? "each"} into{" "}
              <ResourceIdentifier id={intended.location_id} />
            </p>
            {String(intended.quantity) === "0" && (
              <p className="mt-2 text-sm text-green-900">
                The corrected receipt adds no inventory.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[#6d635d]">
          The original and intended receipt states are not available.
        </p>
      )}

      <div className="mt-5 border-t border-gray-200 pt-5">
        <h3 className="font-semibold text-[#04151f]">
          Compensating inventory changes
        </h3>
        <p className="mt-1 text-sm text-[#6d635d]">
          These immutable ledger changes produced the intended state.
        </p>
        <ul className="mt-3 space-y-2">
          {receipt.legs.map((leg, index) => {
            const rawQuantity = String(leg.quantity);
            const removes = rawQuantity.startsWith("-");
            const absoluteQuantity = removes
              ? rawQuantity.slice(1)
              : rawQuantity;
            return (
              <li
                key={[
                  leg.batch_id,
                  leg.location_id,
                  leg.unit,
                  leg.packaging_configuration_id ?? "",
                  rawQuantity,
                  index,
                ].join(":")}
              >
                <strong>{removes ? "Remove" : "Add"}</strong> {absoluteQuantity}{" "}
                {leg.unit} {removes ? "from" : "to"}{" "}
                <ResourceIdentifier id={leg.location_id} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ReceiptDetails({ receipt }: { receipt: InventoryOperationReceipt }) {
  const observedCodes = receipt.result.observed_codes ?? [];
  const batchId = receiptBatchId(receipt);
  const locationId = receiptLocationId(receipt);
  const batch = receipt.batches.find(({ batch_id }) => batch_id === batchId);

  return (
    <>
      {receipt.kind === "correction" ? (
        <CorrectionReceiptDetails receipt={receipt} />
      ) : (
        <section
          aria-labelledby="recorded-details-heading"
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2
            id="recorded-details-heading"
            className="mb-4 text-lg font-semibold text-[#04151f]"
          >
            Recorded details
          </h2>
          <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-3">
            <dt className="font-medium text-[#6d635d]">Batch</dt>
            <dd>
              <ResourceIdentifier id={batchId} />
              {batch?.batch_name && (
                <span className="ml-2 text-[#6d635d]">{batch.batch_name}</span>
              )}
            </dd>
            {(batch?.sku_id || receipt.result.sku_id) && (
              <>
                <dt className="font-medium text-[#6d635d]">SKU</dt>
                <dd>
                  <ResourceIdentifier
                    id={batch?.sku_id ?? receipt.result.sku_id}
                  />
                  {batch?.sku_name && (
                    <span className="ml-2 text-[#6d635d]">
                      {batch.sku_name}
                    </span>
                  )}
                </dd>
              </>
            )}
            <dt className="font-medium text-[#6d635d]">Quantity</dt>
            <dd>
              {quantityText(receiptQuantity(receipt))} {receiptUnit(receipt)}
            </dd>
            {locationId && (
              <>
                <dt className="font-medium text-[#6d635d]">Destination</dt>
                <dd>
                  <ResourceIdentifier id={locationId} />
                </dd>
              </>
            )}
            {receipt.result.description && (
              <>
                <dt className="font-medium text-[#6d635d]">Description</dt>
                <dd>{receipt.result.description}</dd>
              </>
            )}
            <dt className="font-medium text-[#6d635d]">Observed codes</dt>
            <dd>
              {observedCodes.length ? (
                <ul className="space-y-1">
                  {observedCodes.map((code) => (
                    <li key={code}>
                      <code className="break-all text-sm">{code}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[#6d635d]">None recorded</span>
              )}
            </dd>
          </dl>
        </section>
      )}

      <section
        aria-labelledby="current-holdings-heading"
        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2
          id="current-holdings-heading"
          className="mb-2 text-lg font-semibold text-[#04151f]"
        >
          Current holdings
        </h2>
        <p className="mb-4 text-sm text-[#6d635d]">
          Current inventory is shown separately from what this receipt
          originally recorded.
        </p>
        {receipt.current_holdings.length ? (
          <ul className="divide-y divide-gray-100">
            {receipt.current_holdings.map((holding) => (
              <li
                key={[
                  holding.batch_id,
                  holding.location_id,
                  holding.unit,
                  holding.packaging_configuration_id ?? "",
                ].join(":")}
                className="flex flex-wrap items-baseline justify-between gap-2
                  py-2"
              >
                <span>
                  <ResourceIdentifier id={holding.batch_id} /> in{" "}
                  <ResourceIdentifier id={holding.location_id} />
                </span>
                <strong>
                  {quantityText(holding.quantity)} {holding.unit}
                  {String(holding.quantity) === "0" && (
                    <span className="ml-1 font-normal text-[#6d635d]">
                      (empty holding)
                    </span>
                  )}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#6d635d]">
            No positive current holding remains for the affected inventory.
          </p>
        )}
      </section>
    </>
  );
}

function correctionPreview({
  originalQuantity,
  originalLocation,
  correctedQuantity,
  correctedLocation,
}: {
  originalQuantity: bigint | null;
  originalLocation: string | null;
  correctedQuantity: bigint | null;
  correctedLocation: string;
}): React.ReactNode {
  if (
    originalQuantity === null ||
    correctedQuantity === null ||
    !originalLocation ||
    !isBinId(correctedLocation)
  ) {
    return "Enter a valid whole quantity and destination bin to see the exact change.";
  }

  if (correctedQuantity === 0n) {
    return (
      <>
        This means the receipt should have added no inventory. The correction
        will remove {originalQuantity.toString()} each from{" "}
        <ResourceIdentifier id={originalLocation} />.
      </>
    );
  }

  if (originalLocation !== correctedLocation) {
    return (
      <>
        The correction will remove {originalQuantity.toString()} each from{" "}
        <ResourceIdentifier id={originalLocation} /> and add{" "}
        {correctedQuantity.toString()} each to{" "}
        <ResourceIdentifier id={correctedLocation} />.
      </>
    );
  }

  const difference = correctedQuantity - originalQuantity;
  if (difference === 0n) {
    return "This is identical to the original receipt, so there is nothing to correct.";
  }
  if (difference > 0n) {
    return (
      <>
        The correction will add {difference.toString()} more each to{" "}
        <ResourceIdentifier id={originalLocation} />.
      </>
    );
  }
  return (
    <>
      The correction will remove {(-difference).toString()} each from{" "}
      <ResourceIdentifier id={originalLocation} />.
    </>
  );
}

function CorrectionForm({
  receipt,
  api,
  onCorrected,
}: {
  receipt: InventoryOperationReceipt;
  api: ApiClient;
  onCorrected: (
    original: InventoryOperationReceipt,
    correction: InventoryOperationReceipt,
  ) => void;
}) {
  const idempotency = useCommandIdempotency();
  const recordedQuantity = receiptQuantity(receipt);
  const recordedLocation = receiptLocationId(receipt) ?? "";
  const originalWholeQuantity = parseWholeQuantity(recordedQuantity);
  const [quantity, setQuantity] = useState(quantityText(recordedQuantity));
  const [locationId, setLocationId] = useState(recordedLocation);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setQuantity(quantityText(recordedQuantity));
    setLocationId(recordedLocation);
    setError("");
  }, [receipt.operation_id]);

  const canonicalLocation = normalizeInventoriusId(locationId);
  const correctedWholeQuantity = useMemo(() => {
    if (!/^\d+$/.test(quantity)) return null;
    try {
      return BigInt(quantity);
    } catch {
      return null;
    }
  }, [quantity]);
  const unchanged =
    originalWholeQuantity !== null &&
    correctedWholeQuantity === originalWholeQuantity &&
    canonicalLocation === recordedLocation;

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (correctedWholeQuantity === null) {
      setError("Quantity must be a nonnegative whole number.");
      return;
    }
    if (correctedWholeQuantity > BigInt(Number.MAX_SAFE_INTEGER)) {
      setError(
        `Quantity must not exceed ${Number.MAX_SAFE_INTEGER.toLocaleString()}.`,
      );
      return;
    }
    if (!isBinId(canonicalLocation)) {
      setError("Scan or enter a destination BIN label.");
      return;
    }
    if (unchanged) {
      setError("The corrected receipt is identical to the original.");
      return;
    }

    const payload = {
      quantity: Number(correctedWholeQuantity),
      location_id: canonicalLocation,
    };
    setQuantity(String(payload.quantity));
    setLocationId(payload.location_id);
    setSubmitting(true);
    try {
      const response = await api.correctInventoryOperation(
        receipt.operation_id,
        payload,
        idempotency.keyFor(payload),
      );
      if (response.kind === "problem") {
        setError(correctionProblemMessage(response));
        return;
      }

      idempotency.clear();
      let durableCorrection = response.state;
      let durableOriginal = receipt;
      try {
        const [originalResult, correctionResult] = await Promise.all([
          api.getInventoryOperation(receipt.operation_id),
          api.getInventoryOperation(response.state.operation_id),
        ]);
        if (originalResult.kind === "inventory-operation-receipt") {
          durableOriginal = originalResult.state;
        }
        if (correctionResult.kind === "inventory-operation-receipt") {
          durableCorrection = correctionResult.state;
        }
      } catch {
        // The POST response is itself a confirmed durable receipt. A failed
        // follow-up read must not misreport that committed correction as a
        // failed command or invite a second correction attempt.
      }
      onCorrected(durableOriginal, durableCorrection);
    } catch {
      setError(
        "The correction could not be confirmed. Your entries and retry identity have been retained.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="correct-receipt-heading"
      className="rounded-lg border-2 border-[#26532b]/30 bg-[#f7faf7] p-5"
    >
      <h2
        id="correct-receipt-heading"
        className="text-xl font-semibold text-[#04151f]"
      >
        What should this receipt have recorded?
      </h2>
      <p className="mt-2 text-sm text-[#6d635d]">
        The Batch is fixed. This form only corrects the quantity and destination
        recorded by this one receipt.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3
            text-red-700"
        >
          {error}
        </div>
      )}

      <form className="mt-5" onSubmit={submitCorrection} autoComplete="off">
        <div className="mb-5">
          <span className={labelClasses}>Batch</span>
          <div
            className="rounded-md border border-gray-200 bg-gray-100 px-3 py-3"
          >
            <ResourceIdentifier id={receiptBatchId(receipt)} />
          </div>
        </div>

        <label htmlFor="corrected-destination" className={labelClasses}>
          Destination bin
        </label>
        <input
          id="corrected-destination"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          onBlur={() => setLocationId(normalizeInventoriusId(locationId))}
          placeholder="BIN000001"
          required
          spellCheck={false}
          className={`${inputClasses} mb-5`}
        />

        <label htmlFor="corrected-quantity" className={labelClasses}>
          Quantity
        </label>
        <input
          id="corrected-quantity"
          type="number"
          min="0"
          max={Number.MAX_SAFE_INTEGER}
          step="1"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
          className={`${inputClasses} mb-5`}
        />

        <div
          aria-live="polite"
          className="mb-6 grid gap-3 rounded-md border border-gray-200 bg-white
            p-4 sm:grid-cols-2"
        >
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wide
                text-[#6d635d]"
            >
              Recorded
            </h3>
            <p className="mt-1 font-semibold">
              {quantityText(recordedQuantity)} {receiptUnit(receipt)} into{" "}
              <ResourceIdentifier id={recordedLocation} />
            </p>
          </div>
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wide
                text-[#6d635d]"
            >
              Corrected
            </h3>
            <p className="mt-1 font-semibold">
              {quantity || "—"} {receiptUnit(receipt)} into{" "}
              <ResourceIdentifier
                id={isBinId(canonicalLocation) ? canonicalLocation : null}
              />
            </p>
          </div>
          <p className="sm:col-span-2 text-sm text-[#04151f]">
            {correctionPreview({
              originalQuantity: originalWholeQuantity,
              originalLocation: recordedLocation || null,
              correctedQuantity: correctedWholeQuantity,
              correctedLocation: canonicalLocation,
            })}
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || unchanged}
          className={submitClasses}
        >
          {submitting ? "Recording correction…" : "Record correction"}
        </button>
      </form>
    </section>
  );
}

function LinkedCorrection({
  correction,
}: {
  correction: InventoryOperationReceipt;
}) {
  return (
    <section
      aria-labelledby="correction-recorded-heading"
      className="rounded-lg border border-green-300 bg-green-50 p-5"
    >
      <h2
        id="correction-recorded-heading"
        className="text-lg font-semibold text-green-900"
      >
        Correction recorded
      </h2>
      <p className="mt-2 text-green-900">
        The original history remains unchanged. Inventorius added a linked,
        durable correction receipt.
      </p>
      <p className="mt-3">
        <OperationLink operationId={correction.operation_id} />
        {" · "}
        <ReceiptTime value={correction.created_at} />
      </p>
    </section>
  );
}

function InventoryActivityReceipt({ operationId }: { operationId: string }) {
  const api = useContext(ApiContext);
  const { data, frontloadMeta, setData } = useFrontload(
    `inventory-activity-${operationId}`,
    async ({ api: frontloadApi }: FrontloadContext) => ({
      receipt: await frontloadApi.getInventoryOperation(operationId),
    }),
  );
  const [linkedCorrection, setLinkedCorrection] =
    useState<InventoryOperationReceipt | null>(null);

  useEffect(() => {
    setLinkedCorrection(null);
  }, [operationId]);

  if (frontloadMeta.pending) {
    return (
      <div className="mx-auto max-w-[48rem]" role="status">
        Loading inventory receipt…
      </div>
    );
  }

  if (
    frontloadMeta.error ||
    !data?.receipt ||
    data.receipt.kind === "problem"
  ) {
    const message =
      data?.receipt?.kind === "problem"
        ? data.receipt.title
        : "The inventory receipt could not be loaded.";
    return (
      <div
        role="alert"
        className="mx-auto max-w-[48rem] rounded-md border border-red-300
          bg-red-50 px-4 py-3 text-red-700"
      >
        {message}
      </div>
    );
  }

  const receipt = data.receipt.state;
  const correctedBy =
    receipt.corrected_by_operation_id ?? linkedCorrection?.operation_id ?? null;
  const canCorrect =
    receipt.kind === "receive" &&
    receipt.correction.correctable &&
    !correctedBy;

  return (
    <main className="mx-auto max-w-[48rem]">
      <header className="mb-6">
        <p
          className="text-sm font-semibold uppercase tracking-wide
            text-[#6d635d]"
        >
          {receiptKindLabel(receipt)} receipt
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#04151f]">
          Inventory activity
        </h1>
        <div className="mt-3">
          <RecordedSummary receipt={receipt} />
        </div>
        <dl className="mt-4 grid gap-1 text-sm text-[#6d635d]">
          <div>
            <dt className="inline font-semibold">Operation: </dt>
            <dd className="inline font-mono break-all">
              {receipt.operation_id}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Recorded: </dt>
            <dd className="inline">
              <ReceiptTime value={receipt.created_at} />
            </dd>
          </div>
        </dl>
      </header>

      <div className="space-y-5">
        <ReceiptDetails receipt={receipt} />

        <section
          aria-labelledby="history-heading"
          className="rounded-lg border border-blue-200 bg-blue-50 p-5"
        >
          <h2 id="history-heading" className="font-semibold text-blue-950">
            History is immutable
          </h2>
          <p className="mt-2 text-sm text-blue-950">
            A correction never edits or deletes this receipt. It records a new,
            linked operation so the original physical event and the adjustment
            remain inspectable.
          </p>
          {receipt.corrects_operation_id && (
            <p className="mt-3 text-sm">
              This receipt corrects{" "}
              <OperationLink operationId={receipt.corrects_operation_id} />.
            </p>
          )}
          {correctedBy && (
            <p className="mt-3 text-sm">
              This receipt was corrected by{" "}
              <OperationLink operationId={correctedBy} />.
            </p>
          )}
        </section>

        {linkedCorrection && <LinkedCorrection correction={linkedCorrection} />}

        {canCorrect ? (
          <CorrectionForm
            receipt={receipt}
            api={api}
            onCorrected={(original, correction) => {
              setData(() => ({
                receipt: {
                  kind: "inventory-operation-receipt" as const,
                  state: original,
                },
              }));
              setLinkedCorrection(correction);
            }}
          />
        ) : (
          !receipt.corrects_operation_id &&
          !correctedBy && (
            <section
              aria-labelledby="correction-unavailable-heading"
              className="rounded-lg border border-gray-200 bg-gray-50 p-5"
            >
              <h2
                id="correction-unavailable-heading"
                className="font-semibold text-[#04151f]"
              >
                Correction unavailable
              </h2>
              <p className="mt-2 text-sm text-[#6d635d]">
                {formatBlocker(receipt.correction.blocker)}
              </p>
            </section>
          )
        )}
      </div>
    </main>
  );
}

export default function InventoryActivity() {
  const { operationId = "" } = useParams<{ operationId: string }>();

  // react-frontload intentionally runs once per component mount. Route
  // parameters can change while React Router keeps the route element mounted,
  // so key the receipt body by its immutable identity to load the new receipt.
  return (
    <InventoryActivityReceipt key={operationId} operationId={operationId} />
  );
}
