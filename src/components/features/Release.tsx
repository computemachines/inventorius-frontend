// src/components/features/Release.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useContext, useEffect, useState } from "react";

import { ApiContext } from "../../api-client/api-client";
import { normalizeInventoriusId } from "../../identifiers";
import { ToastContext } from "../primitives/Toast";

import "../../styles/form.css";
import { json } from "express";
import ItemLabel from "../primitives/ItemLabel";
import { parse, stringifyUrl } from "query-string";
import { generatePath, useNavigate, useLocation } from "react-router-dom";

function Release() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useContext(ApiContext);
  const { setToastContent: setAlertContent } = useContext(ToastContext);

  const [fromIdValue, setFromIdValue] = useState("");
  const [itemIdValue, setItemIdValue] = useState("");
  const [quantityValue, setQuantityValue] = useState("1");

  useEffect(() => {
    const queryParams = parse(location.search);

    if (queryParams["from"]) {
      setFromIdValue(normalizeInventoriusId(queryParams["from"] as string));
    }
    if (queryParams["item"]) {
      setItemIdValue(normalizeInventoriusId(queryParams["item"] as string));
    }
    if (queryParams["quantity"]) {
      setQuantityValue(queryParams["quantity"] as string);
    }
  }, [location.search]);

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const canonicalFromId = normalizeInventoriusId(fromIdValue);
        const canonicalItemId = normalizeInventoriusId(itemIdValue);

        const resp = await api.release({
          from_id: canonicalFromId,
          item_id: canonicalItemId,
          quantity: parseInt(quantityValue),
        });
        if (resp.kind == "status") {
          setAlertContent({
            content: (
              <div>
                Success, Released {quantityValue} count,{" "}
                <ItemLabel
                  label={canonicalItemId}
                  onClick={(e) => setAlertContent({})}
                />
                , from <ItemLabel label={canonicalFromId} />
              </div>
            ),
            mode: "success",
          });

          setFromIdValue("");
          setItemIdValue("");
          setQuantityValue("1");
          if (location.search) navigate("/release");
        } else {
          setAlertContent({
            content: <div>{resp.title}</div>,
            mode: "failure",
          });
        }
      }}
    >
      <h2 className="form-title">Release</h2>
      <label htmlFor="from_id" className="form-label">
        Bin Label
      </label>
      <input
        type="text"
        className="form-single-code-input"
        id="from_id"
        name="from_id"
        value={fromIdValue}
        onChange={(e) => setFromIdValue(e.target.value)}
        onBlur={() => setFromIdValue(normalizeInventoriusId(fromIdValue))}
      />
      <label htmlFor="item_id" className="form-label">
        Item Label
      </label>
      <input
        type="text"
        name="item_id"
        id="item_id"
        className="form-single-code-input"
        value={itemIdValue}
        onChange={(e) => setItemIdValue(e.target.value)}
        onBlur={() => setItemIdValue(normalizeInventoriusId(itemIdValue))}
      />
      <label htmlFor="quantity" className="form-label">
        Quantity
      </label>
      <input
        type="number"
        name="quantity"
        id="quantity"
        className="form-single-code-input"
        value={quantityValue}
        onChange={(e) => setQuantityValue(e.target.value)}
      />

      <input type="submit" value="Submit" className="form-submit" />
    </form>
  );
}
export default Release;
