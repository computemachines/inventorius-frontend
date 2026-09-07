import * as React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { parse } from "query-string";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";
import { useAuth } from "../auth/AuthContext";
import { Code } from "../composites/CodesInput";
import InventoryBatchSelector from "../composites/InventoryBatchSelector";
import ItemLabel from "../primitives/ItemLabel";
import { ToastContext } from "../primitives/Toast";
import {
  inputClasses,
  isBatchId,
  isBinId,
  isSkuId,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

const emptyEvidence: Code[] = [{ value: "", kind: "associated" }];

export default function Receive() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const idempotency = useCommandIdempotency();

  const { session } = useAuth();
  const principalId = session?.state.principal?.id;
  const lastBinKey = principalId ? `inventorius:last-received-bin:${principalId}` : null;
  const [lastReceivedBin, setLastReceivedBin] = useState("");
  useEffect(() => {
    let remembered = "";
    try {
      if (lastBinKey) remembered = window.localStorage.getItem(lastBinKey) || "";
    } catch { /* Receiving still works when browser storage is unavailable. */ }
    setLastReceivedBin(isBinId(remembered) ? remembered : "");
  }, [lastBinKey]);

  const [binId, setBinId] = useState("");
  const [itemEvidence, setItemEvidence] = useState<Code[]>(emptyEvidence);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const binInput = useRef<HTMLInputElement>(null);
  const itemEvidenceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialBin =
      typeof query.into === "string" ? normalizeInventoriusId(query.into) : "";
    const initialBatch =
      typeof query.batch === "string"
        ? normalizeInventoriusId(query.batch)
        : "";
    const initialQuantity =
      typeof query.quantity === "string" ? query.quantity : "1";

    setBinId(initialBin);
    // A batch deep-link is scanner evidence, not a bypass around resolution.
    setItemEvidence([{ value: initialBatch, kind: "associated" }]);
    setSelectedBatchId("");
    setSelectedSkuId("");
    setQuantity(initialQuantity);
    requestAnimationFrame(() => {
      (initialBin ? itemEvidenceInput : binInput).current?.focus();
    });
  }, [location.search]);

  const receive = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const destination = normalizeInventoriusId(binId);
    const count = Number(quantity);
    const chosenBatchId = selectedBatchId;
    const chosenSkuId = selectedSkuId;
    if (!isBinId(destination)) {
      setValidationError("Scan or enter a destination BIN label.");
      binInput.current?.focus();
      return;
    }
    if (!isBatchId(chosenBatchId) && !isSkuId(chosenSkuId)) {
      setValidationError(
        "Wait for the item to resolve, then choose an existing batch or a SKU for a new batch.",
      );
      itemEvidenceInput.current?.focus();
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    setSubmitting(true);
    try {
      if (isBatchId(chosenBatchId)) {
        const command = {
          kind: "receive" as const,
          batch_id: chosenBatchId,
          quantity: count,
          unit: "each" as const,
          location_id: destination,
        };
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
              Received {count} × <ItemLabel label={chosenBatchId} /> into{" "}
              <ItemLabel label={destination} />.{" "}
              <Link
                className="font-semibold underline"
                to={`/activity/${encodeURIComponent(response.state.operation_id)}`}
              >
                Review or correct
              </Link>
            </p>
          ),
          mode: "success",
        });
      } else {
        const payload = {
          sku_id: chosenSkuId,
          bin_id: destination,
          quantity: count,
          unit: "each" as const,
        };
        const response = await api.intake(payload, idempotency.keyFor(payload));
        if (response.kind === "problem") {
          setValidationError(response.title);
          return;
        }

        setToastContent({
          content: (
            <p>
              Received {count} × new <ItemLabel label={response.state.batch_id} />
              {" under "}<ItemLabel label={chosenSkuId} /> into{" "}
              <ItemLabel label={destination} />.{" "}
              <Link
                className="font-semibold underline"
                to={`/activity/${encodeURIComponent(response.state.operation_id)}`}
              >
                Review or correct
              </Link>
            </p>
          ),
          mode: "success",
        });
      }

      // Keep one physical destination, but only discard a command after its
      // response confirms success. Failed/lost responses retain this exact
      // payload and key for a safe retry.
      setLastReceivedBin(destination);
      try {
        if (lastBinKey) window.localStorage.setItem(lastBinKey, destination);
      } catch { /* A storage failure must not turn a completed receipt into an error. */ }
      idempotency.clear();
      setBinId(destination);
      setItemEvidence(emptyEvidence);
      setSelectedBatchId("");
      setSelectedSkuId("");
      setQuantity("1");
      navigate(`/receive?into=${encodeURIComponent(destination)}`, {
        replace: true,
      });
      requestAnimationFrame(() => itemEvidenceInput.current?.focus());
    } catch {
      setValidationError(
        "Could not submit the receipt. Check the API and retry.",
      );
      itemEvidenceInput.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const captureHref = isBinId(normalizeInventoriusId(binId))
    ? `/capture?into=${encodeURIComponent(normalizeInventoriusId(binId))}`
    : "/capture";

  return (
    <form
      className="max-w-[40rem] mx-auto"
      onSubmit={receive}
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold text-[#04151f] mb-2">
        Receive inventory
      </h2>
      <p className="text-[#6d635d] mb-6">
        Scan an existing batch, or explicitly choose a SKU when this arriving
        object needs a new batch. If it is unknown, use Quick Capture.
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

      <label htmlFor="receive-bin" className={labelClasses}>
        Destination bin
      </label>
      <input
        ref={binInput}
        id="receive-bin"
        value={binId}
        onChange={(event) => setBinId(event.target.value)}
        onBlur={() => setBinId(normalizeInventoriusId(binId))}
        placeholder={lastReceivedBin || "Scan or enter a bin"}
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <InventoryBatchSelector
        id="receive-item-evidence"
        firstInputRef={itemEvidenceInput}
        evidence={itemEvidence}
        setEvidence={setItemEvidence}
        selectedBatchId={selectedBatchId}
        setSelectedBatchId={setSelectedBatchId}
        selectedSkuId={selectedSkuId}
        setSelectedSkuId={setSelectedSkuId}
        unknownAction={
          <Link className="font-semibold underline" to={captureHref}>
            Use Quick Capture instead.
          </Link>
        }
      />

      <label htmlFor="receive-quantity" className={labelClasses}>
        Quantity
      </label>
      <input
        id="receive-quantity"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className={`${inputClasses} mb-7`}
      />

      <button type="submit" disabled={submitting} className={submitClasses}>
        {submitting ? "Receiving…" : "Receive inventory"}
      </button>
    </form>
  );
}
