import * as React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { parse } from "query-string";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";
import ItemLabel from "../primitives/ItemLabel";
import { ToastContext } from "../primitives/Toast";
import {
  inputClasses,
  isBatchId,
  isBinId,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

export default function MoveItem() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const idempotency = useCommandIdempotency();

  const [sourceBinId, setSourceBinId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [destinationBinId, setDestinationBinId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sourceInput = useRef<HTMLInputElement>(null);
  const batchInput = useRef<HTMLInputElement>(null);
  const destinationInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialSource =
      typeof query.from === "string" ? normalizeInventoriusId(query.from) : "";
    const initialBatch =
      typeof query.batch === "string" ? normalizeInventoriusId(query.batch) : "";
    const initialDestination =
      typeof query.to === "string" ? normalizeInventoriusId(query.to) : "";
    const initialQuantity =
      typeof query.quantity === "string" ? query.quantity : "1";

    setSourceBinId(initialSource);
    setBatchId(initialBatch);
    setDestinationBinId(initialDestination);
    setQuantity(initialQuantity);
    requestAnimationFrame(() => {
      (initialSource ? batchInput : sourceInput).current?.focus();
    });
  }, [location.search]);

  const move = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const sourceLocationId = normalizeInventoriusId(sourceBinId);
    const canonicalBatchId = normalizeInventoriusId(batchId);
    const destinationLocationId = normalizeInventoriusId(destinationBinId);
    const count = Number(quantity);

    if (!isBinId(sourceLocationId)) {
      setValidationError("Scan or enter a source BIN label.");
      sourceInput.current?.focus();
      return;
    }
    if (!isBatchId(canonicalBatchId)) {
      setValidationError("Move operations require a BAT label.");
      batchInput.current?.focus();
      return;
    }
    if (!isBinId(destinationLocationId)) {
      setValidationError("Scan or enter a destination BIN label.");
      destinationInput.current?.focus();
      return;
    }
    if (sourceLocationId === destinationLocationId) {
      setValidationError("The source and destination bins must be different.");
      destinationInput.current?.focus();
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    const command = {
      kind: "transfer" as const,
      batch_id: canonicalBatchId,
      quantity: count,
      unit: "each" as const,
      source_location_id: sourceLocationId,
      destination_location_id: destinationLocationId,
    };

    setSubmitting(true);
    try {
      const response = await api.postInventoryOperation(
        command,
        idempotency.keyFor(command),
      );
      if (response.kind === "problem") {
        setValidationError(response.title);
        return;
      }

      setToastContent({
        content: (
          <p>
            Moved {count} × <ItemLabel label={canonicalBatchId} /> from{" "}
            <ItemLabel label={sourceLocationId} /> to{" "}
            <ItemLabel label={destinationLocationId} />.
          </p>
        ),
        mode: "success",
      });

      // Repeated moves normally use the same two physical bins.
      idempotency.clear();
      setSourceBinId(sourceLocationId);
      setDestinationBinId(destinationLocationId);
      setBatchId("");
      setQuantity("1");
      navigate(
        `/move?from=${encodeURIComponent(sourceLocationId)}&to=${encodeURIComponent(destinationLocationId)}`,
        { replace: true },
      );
      requestAnimationFrame(() => batchInput.current?.focus());
    } catch {
      setValidationError("Could not submit the move. Check the API and retry.");
      batchInput.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="max-w-[40rem] mx-auto" onSubmit={move} autoComplete="off">
      <h2 className="text-2xl font-bold text-[#04151f] mb-2">Move inventory</h2>
      <p className="text-[#6d635d] mb-6">
        Scan the source bin, the batch to move, then the destination bin.
      </p>

      {validationError && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3
            text-red-700"
        >
          {validationError}
        </div>
      )}

      <label htmlFor="move-source-bin" className={labelClasses}>
        Source bin
      </label>
      <input
        ref={sourceInput}
        id="move-source-bin"
        value={sourceBinId}
        onChange={(event) => setSourceBinId(event.target.value)}
        onBlur={() => setSourceBinId(normalizeInventoriusId(sourceBinId))}
        placeholder="BIN000001"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="move-batch" className={labelClasses}>
        Batch
      </label>
      <input
        ref={batchInput}
        id="move-batch"
        value={batchId}
        onChange={(event) => setBatchId(event.target.value)}
        onBlur={() => setBatchId(normalizeInventoriusId(batchId))}
        placeholder="BAT000001"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="move-destination-bin" className={labelClasses}>
        Destination bin
      </label>
      <input
        ref={destinationInput}
        id="move-destination-bin"
        value={destinationBinId}
        onChange={(event) => setDestinationBinId(event.target.value)}
        onBlur={() =>
          setDestinationBinId(normalizeInventoriusId(destinationBinId))
        }
        placeholder="BIN000002"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="move-quantity" className={labelClasses}>
        Quantity
      </label>
      <input
        id="move-quantity"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className={`${inputClasses} mb-7`}
      />

      <button type="submit" disabled={submitting} className={submitClasses}>
        {submitting ? "Moving…" : "Move batch"}
      </button>
    </form>
  );
}
