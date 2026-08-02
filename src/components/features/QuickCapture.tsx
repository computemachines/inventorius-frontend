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
  const [quantityMode, setQuantityMode] = useState<"estimated" | "exact">(
    "estimated"
  );
  const [unit, setUnit] = useState("each");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [capacity, setCapacity] = useState("");
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
    if (!Number.isFinite(count) || count <= 0) {
      setValidationError("Enter a positive count or estimate.");
      return;
    }
    if (unit === "each" && !Number.isInteger(count)) {
      setValidationError("Counts of individual items must be whole numbers.");
      return;
    }
    if (quantityMode === "exact" && unit !== "each") {
      setValidationError("Measured material should be recorded as an estimate for now.");
      return;
    }

    const lowerValue = lower.trim() === "" ? 0 : Number(lower);
    const upperValue = upper.trim() === "" ? count * 2 : Number(upper);
    const capacityValue = capacity.trim() === "" ? null : Number(capacity);
    if (
      quantityMode === "estimated" &&
      (!Number.isFinite(lowerValue) ||
        !Number.isFinite(upperValue) ||
        (capacityValue !== null && !Number.isFinite(capacityValue)) ||
        lowerValue < 0 ||
        lowerValue > count ||
        count > upperValue ||
        (capacityValue !== null && upperValue > capacityValue))
    ) {
      setValidationError(
        "Quantity must follow lower bound ≤ best estimate ≤ upper bound ≤ capacity."
      );
      return;
    }
    if (
      quantityMode === "estimated" &&
      unit === "each" &&
      ![lowerValue, upperValue, capacityValue]
        .filter((value): value is number => value !== null)
        .every(Number.isInteger)
    ) {
      setValidationError("Counts of individual items must use whole bounds.");
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
        unit,
        ...(quantityMode === "exact"
          ? { quantity: count, unit: "each" as const }
          : {
              quantity_claim: {
                domain: unit === "each" ? ("discrete" as const) : ("continuous" as const),
                basis: "estimated" as const,
                preferred: quantity,
                ...(lower.trim() === "" ? {} : { lower: lower.trim() }),
                ...(upper.trim() === "" ? {} : { upper: upper.trim() }),
                ...(capacity.trim() === "" ? {} : { capacity: capacity.trim() }),
              },
            }),
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
            {response.state.quantity_native ? (
              <>
                Captured an estimate of {response.state.quantity_claim.lower}–
                {response.state.quantity_claim.upper} {response.state.unit} for{" "}
              </>
            ) : (
              <>
                Captured {"quantity" in response.state ? response.state.quantity : "?"} ×{" "}
              </>
            )}
            {response.state.description} as{" "}
            <ItemLabel label={response.state.sku_id} /> in{" "}
            <ItemLabel label={response.state.bin_id} />.{" "}
            <Link
              className="font-semibold underline"
              to={
                response.state.quantity_native
                  ? `/batch/${encodeURIComponent(response.state.batch_id)}`
                  : `/activity/${encodeURIComponent(response.state.operation_id)}`
              }
            >
              {response.state.quantity_native ? "Review estimate" : "Review or correct"}
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
      setLower("");
      setUpper("");
      setCapacity("");
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

      <fieldset className="mb-5">
        <legend className={labelClasses}>How certain is the quantity?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-[#cdd2d6] bg-white px-4 py-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="capture-quantity-mode"
              checked={quantityMode === "estimated"}
              onChange={() => setQuantityMode("estimated")}
            />
            Estimated
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="capture-quantity-mode"
              checked={quantityMode === "exact"}
              onChange={() => {
                setQuantityMode("exact");
                setUnit("each");
              }}
            />
            Counted exactly
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,0.6fr)] gap-3 mb-5">
        <div>
          <label htmlFor="capture-quantity" className={labelClasses}>
            {quantityMode === "estimated" ? "Best estimate" : "Exact count"}
          </label>
          <input
            id="capture-quantity"
            type="number"
            min="0"
            step={unit === "each" ? "1" : "any"}
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="capture-unit" className={labelClasses}>Unit</label>
          <select
            id="capture-unit"
            value={unit}
            disabled={quantityMode === "exact"}
            onChange={(event) => setUnit(event.target.value)}
            className={inputClasses}
          >
            <option value="each">items</option>
            <option value="milliliter">milliliters</option>
            <option value="gram">grams</option>
            <option value="meter">meters</option>
          </select>
        </div>
      </div>

      {quantityMode === "estimated" && (
        <details className="mb-7 rounded-md border border-[#cdd2d6] bg-[#f8fafb] px-4 py-3">
          <summary className="cursor-pointer font-semibold text-[#29434e]">
            I know more about the range
          </summary>
          <p className="mt-2 mb-4 text-sm text-[#6d635d]">
            Blank bounds use zero and twice your estimate. Capacity is a hard
            physical maximum, such as the bottle size.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="capture-lower" className={labelClasses}>Lower bound</label>
              <input
                id="capture-lower"
                type="number"
                min="0"
                step={unit === "each" ? "1" : "any"}
                placeholder="0"
                value={lower}
                onChange={(event) => setLower(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="capture-upper" className={labelClasses}>Upper bound</label>
              <input
                id="capture-upper"
                type="number"
                min="0"
                step={unit === "each" ? "1" : "any"}
                placeholder="Twice estimate"
                value={upper}
                onChange={(event) => setUpper(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="capture-capacity" className={labelClasses}>Capacity</label>
              <input
                id="capture-capacity"
                type="number"
                min="0"
                step={unit === "each" ? "1" : "any"}
                placeholder="Optional"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className={inputClasses}
              />
            </div>
          </div>
        </details>
      )}

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
