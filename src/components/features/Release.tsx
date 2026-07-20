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

export default function Release() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const idempotency = useCommandIdempotency();

  const [binId, setBinId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const binInput = useRef<HTMLInputElement>(null);
  const batchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialBin =
      typeof query.from === "string" ? normalizeInventoriusId(query.from) : "";
    const initialBatch =
      typeof query.batch === "string"
        ? normalizeInventoriusId(query.batch)
        : "";
    const initialQuantity =
      typeof query.quantity === "string" ? query.quantity : "1";

    setBinId(initialBin);
    setBatchId(initialBatch);
    setQuantity(initialQuantity);
    requestAnimationFrame(() => {
      (initialBin ? batchInput : binInput).current?.focus();
    });
  }, [location.search]);

  const release = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const locationId = normalizeInventoriusId(binId);
    const canonicalBatchId = normalizeInventoriusId(batchId);
    const count = Number(quantity);

    if (!isBinId(locationId)) {
      setValidationError("Scan or enter a BIN label.");
      binInput.current?.focus();
      return;
    }
    if (!isBatchId(canonicalBatchId)) {
      setValidationError("Release operations require a BAT label.");
      batchInput.current?.focus();
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    const command = {
      kind: "release" as const,
      batch_id: canonicalBatchId,
      quantity: count,
      unit: "each" as const,
      location_id: locationId,
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
            Released {count} × <ItemLabel label={canonicalBatchId} /> from{" "}
            <ItemLabel label={locationId} />.
          </p>
        ),
        mode: "success",
      });

      // Releasing several things usually starts from one physical bin.
      idempotency.clear();
      setBinId(locationId);
      setBatchId("");
      setQuantity("1");
      navigate(`/release?from=${encodeURIComponent(locationId)}`, {
        replace: true,
      });
      requestAnimationFrame(() => batchInput.current?.focus());
    } catch {
      setValidationError(
        "Could not submit the release. Check the API and retry.",
      );
      batchInput.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="max-w-[40rem] mx-auto"
      onSubmit={release}
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold text-[#04151f] mb-2">
        Release inventory
      </h2>
      <p className="text-[#6d635d] mb-6">
        Record a batch leaving tracked inventory. Use Move if it remains in
        another bin.
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

      <label htmlFor="release-bin" className={labelClasses}>
        Source bin
      </label>
      <input
        ref={binInput}
        id="release-bin"
        value={binId}
        onChange={(event) => setBinId(event.target.value)}
        onBlur={() => setBinId(normalizeInventoriusId(binId))}
        placeholder="BIN000001"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="release-batch" className={labelClasses}>
        Batch
      </label>
      <input
        ref={batchInput}
        id="release-batch"
        value={batchId}
        onChange={(event) => setBatchId(event.target.value)}
        onBlur={() => setBatchId(normalizeInventoriusId(batchId))}
        placeholder="BAT000001"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="release-quantity" className={labelClasses}>
        Quantity
      </label>
      <input
        id="release-quantity"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className={`${inputClasses} mb-7`}
      />

      <button type="submit" disabled={submitting} className={submitClasses}>
        {submitting ? "Releasing…" : "Release batch"}
      </button>
    </form>
  );
}
