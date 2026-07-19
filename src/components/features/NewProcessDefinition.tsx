import * as React from "react";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { ProcessDefinitionWrite } from "../../api-client/data-models";
import { ToastContext } from "../primitives/Toast";
import ProcessDefinitionForm from "./ProcessDefinitionForm";


export default function NewProcessDefinition() {
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const create = async (definition: ProcessDefinitionWrite) => {
    setSubmitting(true);
    try {
      const response = await api.createProcessDefinition(definition);
      if (response.kind === "problem") {
        setToastContent({
          content: <p>{response.title}</p>,
          mode: "failure",
        });
        return;
      }

      const id = response.Id?.split("/").filter(Boolean).pop();
      setToastContent({
        content: <p>Process definition created.</p>,
        mode: "success",
      });
      navigate(id ? `/processes/${id}` : "/processes");
    } catch (error) {
      setToastContent({
        content: <p>Could not reach the process-definition API.</p>,
        mode: "failure",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProcessDefinitionForm
      heading="Define manufacturing process"
      submitLabel="Create process"
      submitting={submitting}
      onSubmit={create}
      onCancel={() => navigate("/processes")}
    />
  );
}
