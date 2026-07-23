import * as React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { parse } from "query-string";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";
import CodesInput, { Code } from "../composites/CodesInput";
import { ToastContext } from "../primitives/Toast";
import ItemLabel from "../primitives/ItemLabel";
import {
  inputClasses,
  isBinId,
  labelClasses,
  submitClasses,
  useCommandIdempotency,
} from "./inventory-operation-form";

export default function QuickCapture() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const idempotency = useCommandIdempotency();

  const [description, setDescription] = useState("");
  const [codes, setCodes] = useState<Code[]>([
    { kind: "owned", value: "" },
  ]);
  const [binId, setBinId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const descriptionInput = useRef<HTMLInputElement>(null);
  const binInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialBin =
      typeof query.into === "string" ? normalizeInventoriusId(query.into) : "";
    setBinId(initialBin);
    requestAnimationFrame(() => {
      (initialBin ? descriptionInput : binInput).current?.focus();
    });
  }, [location.search]);

  const capture = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const destination = normalizeInventoriusId(binId);
    const summary = description.trim();
    const count = Number(quantity);

    if (!isBinId(destination)) {
      setValidationError("Scan or enter a BIN label.");
      binInput.current?.focus();
      return;
    }
    if (!summary) {
      setValidationError("Describe the item well enough to find it again.");
      descriptionInput.current?.focus();
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    setSubmitting(true);
    try {
      const observedCodes = Array.from(
        new Set(codes.map(({ value }) => value.trim()).filter(Boolean))
      ).sort();
      const payload = {
        description: summary,
        bin_id: destination,
        quantity: count,
        unit: "each" as const,
        ...(observedCodes.length ? { observed_codes: observedCodes } : {}),
      };
      const response = await api.quickCapture(
        payload,
        idempotency.keyFor(payload)
      );

      if (response.kind === "problem") {
        setValidationError(response.title);
        return;
      }

      setToastContent({
        content: (
          <p>
            Captured {response.state.quantity} × {response.state.description} as{" "}
            <ItemLabel label={response.state.sku_id} /> in{" "}
            <ItemLabel label={response.state.bin_id} />.{" "}
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

      // Capturing a box of unsorted parts usually produces several entries in
      // the same destination. Retain the bin and return to the description.
      setBinId(destination);
      setDescription("");
      setCodes([{ kind: "owned", value: "" }]);
      setQuantity("1");
      idempotency.clear();
      navigate(`/capture?into=${encodeURIComponent(destination)}`, {
        replace: true,
      });
      requestAnimationFrame(() => descriptionInput.current?.focus());
    } catch {
      setValidationError("The item could not be captured. Check the API and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="max-w-[40rem] mx-auto"
      onSubmit={capture}
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold text-[#04151f] mb-2">Quick capture</h2>
      <p className="text-[#6d635d] mb-6">
        Record enough to find the item and put it somewhere real. Classification
        and detailed attributes can wait.
      </p>

      {validationError && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700"
        >
          {validationError}
        </div>
      )}

      <label htmlFor="capture-bin" className={labelClasses}>
        Destination bin
      </label>
      <input
        ref={binInput}
        id="capture-bin"
        value={binId}
        onChange={(event) => setBinId(event.target.value)}
        onBlur={() => setBinId(normalizeInventoriusId(binId))}
        placeholder="BIN000001"
        spellCheck={false}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="capture-description" className={labelClasses}>
        What is it?
      </label>
      <input
        ref={descriptionInput}
        id="capture-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Blue bag of assorted JST connectors"
        maxLength={500}
        spellCheck={true}
        className={`${inputClasses} mb-5`}
      />

      <label htmlFor="capture-observed-codes" className={labelClasses}>
        Observed codes (optional)
      </label>
      <div className="mb-5">
        <CodesInput
          id="capture-observed-codes"
          codes={codes}
          setCodes={setCodes}
          showRelationshipControls={false}
        />
      </div>

      <label htmlFor="capture-quantity" className={labelClasses}>
        Quantity
      </label>
      <input
        id="capture-quantity"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className={`${inputClasses} mb-7`}
      />

      <button
        type="submit"
        disabled={submitting}
        className={submitClasses}
      >
        {submitting ? "Capturing…" : "Capture item"}
      </button>
    </form>
  );
}
