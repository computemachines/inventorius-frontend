// src/components/features/MoveItem.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useState, useContext } from "react";
import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";

import "../../styles/form.css";
import { ToastContext } from "../primitives/Toast";
import ItemLabel from "../primitives/ItemLabel";

export default function MoveItem() {
  const api = useContext(ApiContext);
  const { setToastContent: setAlertContent } = useContext(ToastContext);
  const clearAlert = (e) => setAlertContent({});

  const [itemId, setItemId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState("1");

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const canonicalItemId = normalizeInventoriusId(itemId);
        const canonicalFromId = normalizeInventoriusId(fromId);
        const canonicalToId = normalizeInventoriusId(toId);

        const resp = await api.move({
          from_id: canonicalFromId,
          to_id: canonicalToId,
          quantity: parseInt(quantity),
          item_id: canonicalItemId,
        });

        if (resp.kind == "problem") {
          setAlertContent({
            mode: "failure",
            content: (
              <div>
                <span>{resp.title}</span>
              </div>
            ),
          });
        } else {
          setAlertContent({
            mode: "success",
            content: (
              <div>
                Success. Moved {quantity} count,
                <ItemLabel label={canonicalItemId} onClick={clearAlert} /> from{" "}
                <ItemLabel label={canonicalFromId} onClick={clearAlert} /> to{" "}
                <ItemLabel label={canonicalToId} onClick={clearAlert} />
              </div>
            ),
          });
        }
      }}
    >
      <h2 className="form-title">Move Item</h2>
      <label htmlFor="item_id" className="form-label">
        Item
      </label>
      <input
        type="text"
        className="form-single-code-input"
        id="item_id"
        name="item_id"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        onBlur={() => setItemId(normalizeInventoriusId(itemId))}
      />

      <label htmlFor="from_id" className="form-label">
        Source
      </label>
      <input
        className="form-single-code-input"
        id="from_id"
        name="from_id"
        type="text"
        value={fromId}
        onChange={(e) => setFromId(e.target.value)}
        onBlur={() => setFromId(normalizeInventoriusId(fromId))}
      />

      <label htmlFor="to_id" className="form-label">
        Destination
      </label>
      <input
        className="form-single-code-input"
        id="to_id"
        name="to_id"
        type="text"
        value={toId}
        onChange={(e) => setToId(e.target.value)}
        onBlur={() => setToId(normalizeInventoriusId(toId))}
      />

      <label htmlFor="quantity" className="form-label">
        Quantity
      </label>
      <input
        className="form-single-code-input"
        id="quantity"
        name="quantity"
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      <input type="submit" value="Submit" className="form-submit" />
    </form>
  );
}
