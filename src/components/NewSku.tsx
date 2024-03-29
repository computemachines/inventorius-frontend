import * as React from "react";
import { useContext, useRef, useState } from "react";
import { useFrontload } from "react-frontload";
import { ApiContext, FrontloadContext } from "../api-client/api-client";

import "../styles/form.css";
import { ToastContext } from "./Toast";
import CodesInput, { Code } from "./CodesInput";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";

function NewSku() {
  const { data, frontloadMeta, setData } = useFrontload(
    "new-sku-component",
    async ({ api }: FrontloadContext) => ({
      nextSku: await api.getNextSku(),
    })
  );
  const api = useContext(ApiContext);
  const { setToastContent: setAlertContent } = useContext(ToastContext);
  const [skuIdValue, setSkuIdValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [codes, setCodes] = useState<Code[]>([]);
  const skuInputRef = useRef(null);

  let skuIdPlaceholder;
  if (frontloadMeta.pending) {
    skuIdPlaceholder = "Loading...";
  } else if (frontloadMeta.error) {
    throw Error("API Error");
  } else {
    skuIdPlaceholder = data.nextSku.state;
  }

  function setClearForm() {
    setSkuIdValue("");
    setNameValue("");
    setCodes([]);
  }

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();

        const ownedCodes = [];
        const associatedCodes = [];
        for (const code of codes) {
          if (code.value === "") continue;
          switch (code.kind) {
            case "owned":
              ownedCodes.push(code.value);
              break;
            case "associated":
              associatedCodes.push(code.value);
              break;
          }
        }
        const resp = await api.createSku({
          id: skuIdValue || skuIdPlaceholder,
          name: nameValue,
          owned_codes: ownedCodes,
          associated_codes: associatedCodes,
        });
        if (resp.kind == "status") {
          setClearForm();
          setAlertContent({
            content: (
              <p>
                Success,{" "}
                <ItemLabel url={resp.Id} onClick={() => setAlertContent({})} />{" "}
                created.
              </p>
            ),
            mode: "success",
          });
          const nextSku = await api.getNextSku();
          setData(() => ({ nextSku }));
          skuInputRef.current.focus();
        } else {
          setAlertContent({
            content: <p>{resp.title}</p>,
            mode: "failure",
          });
        }
      }}
    >
      <h2 className="form-title">New Sku</h2>
      <label htmlFor="sku_id" className="form-label">
        Sku Label
      </label>
      <div className="flex-row">
        <input
          type="text"
          ref={skuInputRef}
          name="sku_id"
          id="sku_id"
          placeholder={skuIdPlaceholder}
          className="form-single-code-input"
          value={skuIdValue}
          onChange={(e) => setSkuIdValue(e.target.value)}
        />
        <PrintButton value={skuIdValue || skuIdPlaceholder} />
      </div>
      <label htmlFor="name" className="form-label">
        Name
      </label>
      <input
        type="text"
        name="name"
        id="name"
        className="form-single-code-input"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
      />
      <label htmlFor="codes" className="form-label">
        Codes
      </label>
      <CodesInput id="codes" codes={codes} setCodes={setCodes} />
      <input type="submit" value="Submit" className="form-submit" />
    </form>
  );
}
export default NewSku;
