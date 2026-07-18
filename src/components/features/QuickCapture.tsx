import * as React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { parse } from "query-string";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { ToastContext } from "../primitives/Toast";
import ItemLabel from "../primitives/ItemLabel";

const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mb-1.5";
const inputClasses =
  "w-full rounded-md border border-[#cdd2d6] bg-white px-3 py-3 text-base text-[#04151f] focus:border-[#26532b] focus:outline-none focus:ring-2 focus:ring-[#26532b]/20";

function normalizeBinId(value: string): string {
  return value.trim().toUpperCase();
}

export default function QuickCapture() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  const [description, setDescription] = useState("");
  const [binId, setBinId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const descriptionInput = useRef<HTMLInputElement>(null);
  const binInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialBin =
      typeof query.into === "string" ? normalizeBinId(query.into) : "";
    setBinId(initialBin);
    requestAnimationFrame(() => {
      (initialBin ? descriptionInput : binInput).current?.focus();
    });
  }, [location.search]);

  const capture = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const destination = normalizeBinId(binId);
    const summary = description.trim();
    const count = Number(quantity);

    if (!/^BIN\d+$/.test(destination)) {
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
      const response = await api.quickCapture({
        description: summary,
        bin_id: destination,
        quantity: count,
      });

      if (response.kind === "problem") {
        setValidationError(response.title);
        return;
      }

      setToastContent({
        content: (
          <p>
            Captured {count} × {summary} as{" "}
            <ItemLabel label={response.state.sku_id} /> in{" "}
            <ItemLabel label={destination} />.
          </p>
        ),
        mode: "success",
      });

      // Capturing a box of unsorted parts usually produces several entries in
      // the same destination. Retain the bin and return to the description.
      setBinId(destination);
      setDescription("");
      setQuantity("1");
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
      <div className="flex gap-2 mb-5">
        <input
          ref={binInput}
          id="capture-bin"
          value={binId}
          onChange={(event) => setBinId(event.target.value)}
          onBlur={() => setBinId(normalizeBinId(binId))}
          onKeyDown={(event) => {
            const scannedBin = normalizeBinId(event.currentTarget.value);
            const isForwardTabFromValidBin =
              event.key === "Tab" &&
              !event.shiftKey &&
              /^BIN\d+$/.test(scannedBin);

            if (event.key === "Enter" || isForwardTabFromValidBin) {
              event.preventDefault();
              setBinId(scannedBin);
              descriptionInput.current?.focus();
            }
          }}
          placeholder="BIN000001"
          className={inputClasses}
        />
        {binId && (
          <button
            type="button"
            onClick={() => {
              setBinId("");
              navigate("/capture", { replace: true });
              binInput.current?.focus();
            }}
            className="rounded-md border border-[#cdd2d6] px-4 text-[#6d635d] hover:bg-[#f1f3f4]"
          >
            Change
          </button>
        )}
      </div>

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
        className={`${inputClasses} mb-5`}
      />

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
        className="w-full rounded-md bg-[#26532b] px-6 py-3 text-base font-semibold text-white hover:bg-[#1e4423] disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Capturing…" : "Capture item"}
      </button>
    </form>
  );
}
