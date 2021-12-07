import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { useFrontload } from "react-frontload";
import { ApiContext, FrontloadContext } from "../api-client/inventory-api";

import "../styles/form.css";

import { AlertContext } from "./Alert";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";

function NewBin() {
  const { setAlertContent } = useContext(AlertContext);
  const api = useContext(ApiContext);
  const [binIdValue, setBinIdValue] = useState("");
  let binIdPlaceholder = "Loading";

  const { data, setData, frontloadMeta } = useFrontload(
    "new-bin-component",
    async ({ api }: FrontloadContext) => ({
      nextBin: await api.getNextBin(),
    })
  );

  if (frontloadMeta.error) binIdPlaceholder = "API Error";
  if (frontloadMeta.done && data.nextBin.kind != "problem")
    binIdPlaceholder = data.nextBin.state;

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();

        const resp = await api.newBin({
          id: binIdValue || binIdPlaceholder,
          props: null,
        });
        const json = await resp.json();
        if (resp.ok) {
          setBinIdValue("");
          setAlertContent({
            content: (
              <p>
                Success,{" "}
                <ItemLabel url={json.Id} onClick={(e) => setAlertContent({})} />{" "}
                created.
              </p>
            ),
            mode: "success",
          });
        } else {
          setAlertContent({
            content: <p>{json.title}</p>,
            mode: "failure",
          });
        }

        // data.api.getNextBin()
        //   .then((nextBin) => setData((data) => ({ ...data, nextBin })));
      }}
    >
      <h2 className="form-title">New Bin</h2>
      <label htmlFor="bin_id" className="form-label">
        Bin Label
      </label>
      <div className="flex-row">
        <input
          type="text"
          name="bin_id"
          id="bin_id"
          placeholder={binIdPlaceholder}
          className="form-single-code-input"
          value={binIdValue}
          onChange={(e) => setBinIdValue(e.target.value)}
        />
        <PrintButton value={binIdValue || binIdPlaceholder} />
      </div>
      <input type="submit" value="Submit" className="form-submit" />
    </form>
  );
}

export default NewBin;
