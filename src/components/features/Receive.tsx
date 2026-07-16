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

function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

export default function Receive() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  const [binId, setBinId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const binInput = useRef<HTMLInputElement>(null);
  const itemInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = parse(location.search);
    const initialBin =
      typeof query.into === "string" ? normalizeId(query.into) : "";
    const initialItem =
      typeof query.item === "string" ? normalizeId(query.item) : "";
    const initialQuantity =
      typeof query.quantity === "string" ? query.quantity : "1";

    setBinId(initialBin);
    setItemId(initialItem);
    setQuantity(initialQuantity);

    requestAnimationFrame(() => {
      (initialBin ? itemInput : binInput).current?.focus();
    });
  }, [location.search]);

  const receive = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    const destination = normalizeId(binId);
    const item = normalizeId(itemId);
    const count = Number(quantity);

    if (!destination.startsWith("BIN")) {
      setValidationError("Scan or enter a BIN label.");
      binInput.current?.focus();
      return;
    }
    if (!item.startsWith("SKU") && !item.startsWith("BAT")) {
      setValidationError("Scan or enter a SKU or batch label.");
      itemInput.current?.focus();
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.receive({
        into_id: destination,
        item_id: item,
        quantity: count,
      });

      if (response.kind !== "status") {
        setValidationError(response.title);
        return;
      }

      setToastContent({
        content: (
          <p>
            Added {count} × <ItemLabel label={item} /> to{" "}
            <ItemLabel label={destination} />.
          </p>
        ),
        mode: "success",
      });

      // A receiving session normally puts several items into one physical bin.
      // Keep the destination selected and prepare for the next scan.
      setBinId(destination);
      setItemId("");
      setQuantity("1");
      navigate(`/receive?into=${encodeURIComponent(destination)}`, {
        replace: true,
      });
      requestAnimationFrame(() => itemInput.current?.focus());
    } finally {
      setSubmitting(false);
    }
  };

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
        Scan a destination bin once, then scan each SKU or batch going into it.
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
      <div className="flex gap-2 mb-5">
        <input
          ref={binInput}
          id="receive-bin"
          value={binId}
          onChange={(event) => setBinId(event.target.value)}
          onBlur={() => setBinId(normalizeId(binId))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              itemInput.current?.focus();
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
              navigate("/receive", { replace: true });
              binInput.current?.focus();
            }}
            className="rounded-md border border-[#cdd2d6] px-4 text-[#6d635d]
              hover:bg-[#f1f3f4]"
          >
            Change
          </button>
        )}
      </div>

      <label htmlFor="receive-item" className={labelClasses}>
        Item
      </label>
      <input
        ref={itemInput}
        id="receive-item"
        value={itemId}
        onChange={(event) => setItemId(event.target.value)}
        onBlur={() => setItemId(normalizeId(itemId))}
        placeholder="SKU or BAT label"
        className={`${inputClasses} mb-5`}
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

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-[#26532b] px-6 py-3 text-base
          font-semibold text-white hover:bg-[#1e4423] disabled:cursor-wait
          disabled:opacity-60"
      >
        {submitting ? "Receiving…" : "Receive item"}
      </button>
    </form>
  );
}
