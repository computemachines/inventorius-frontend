import * as React from "react";
import { useContext, useState } from "react";
import { useFrontload } from "react-frontload";
import ReactModal from "react-modal";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { ApiContext, FrontloadContext } from "../../api-client/api-client";
import {
  Problem,
  ProcessDefinition as ApiProcessDefinition,
  ProcessDefinitionState,
  ProcessDefinitionWrite,
  ProcessRequirement,
} from "../../api-client/data-models";
import FormSection from "../primitives/FormSection";
import { FourOhFour } from "../primitives/FourOhFour";
import PageHeading from "../primitives/PageHeading";
import { ToastContext } from "../primitives/Toast";
import ProcessDefinitionForm, {
  PROCESS_KIND_LABELS,
} from "./ProcessDefinitionForm";


function Requirements({ requirements }: { requirements: ProcessRequirement[] }) {
  return (
    <ul className="space-y-2">
      {requirements.map((requirement, index) => (
        <li
          key={`${requirement.role}-${index}`}
          className="rounded-md border border-[#cdd2d6] bg-white px-3 py-2"
        >
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold text-[#04151f]">{requirement.role}</span>
            <span className="text-[#6d635d]">
              {requirement.quantity === undefined
                ? `Variable ${requirement.unit}`
                : `${requirement.quantity} ${requirement.unit}`}
            </span>
          </div>
          {requirement.sku_id && (
            <Link
              to={`/sku/${requirement.sku_id}`}
              className="mt-1 inline-block font-mono text-sm text-[#0c3764] hover:underline"
            >
              {requirement.sku_id}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ProcessDefinition({ editable = false }: { editable?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const requestedRevision = Number(searchParams.get("revision"));
  const revision = Number.isInteger(requestedRevision) && requestedRevision > 0
    ? requestedRevision
    : undefined;
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, frontloadMeta } = useFrontload(
    `process-definition-${id}-${revision || "current"}`,
    async ({ api }: FrontloadContext) => {
      const definition = await api.getProcessDefinition(id, revision);
      const revisions = definition.kind === "process-definition"
        ? await definition.revisions()
        : definition;
      return { definition, revisions };
    }
  );

  if (frontloadMeta.pending) return <p>Loading process definition...</p>;
  if (frontloadMeta.error) return <p>Unable to load process definition.</p>;

  const definition = data?.definition as ApiProcessDefinition | Problem;
  if (!definition) return <p>Unable to load process definition.</p>;
  if (definition.kind === "problem") {
    const loadProblem = definition as Problem;
    if (loadProblem.type === "missing-resource") return <FourOhFour />;
    return <p>{loadProblem.title || "Unable to load process definition."}</p>;
  }

  const state = definition.state;
  const revisions = data?.revisions as ProcessDefinitionState[] | Problem;

  const save = async (nextDefinition: ProcessDefinitionWrite) => {
    setSubmitting(true);
    try {
      const response = await api.hydrate(definition).update(nextDefinition);
      if (response.kind === "problem") {
        setToastContent({ content: <p>{response.title}</p>, mode: "failure" });
        return;
      }
      setToastContent({
        content: <p>Process definition updated.</p>,
        mode: "success",
      });
      navigate(`/processes/${id}`);
    } catch (error) {
      setToastContent({
        content: <p>Could not reach the process-definition API.</p>,
        mode: "failure",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (editable) {
    return (
      <ProcessDefinitionForm
        key={`${state.id}-${state.revision}`}
        initial={state}
        heading={`Edit ${state.name}`}
        submitLabel="Save new revision"
        submitting={submitting}
        onSubmit={save}
        onCancel={() => navigate(`/processes/${id}`)}
      />
    );
  }

  return (
    <div>
      <ReactModal
        isOpen={showDelete}
        onRequestClose={() => setShowDelete(false)}
        className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl"
        overlayClassName="fixed inset-0 bg-black/50"
      >
        <h3 className="mb-3 text-lg font-bold text-[#04151f]">
          Delete this process definition?
        </h3>
        <p className="mb-6 text-[#6d635d]">
          Definitions used by process runs cannot be deleted. Otherwise this removes
          all of the definition&apos;s revisions.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowDelete(false)}
            className="rounded-md border border-[#cdd2d6] px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            onClick={async () => {
              const response = await api.hydrate(definition).delete();
              if (response.kind === "problem") {
                setToastContent({ content: <p>{response.title}</p>, mode: "failure" });
                setShowDelete(false);
                return;
              }
              setToastContent({
                content: <p>Process definition deleted.</p>,
                mode: "success",
              });
              navigate("/processes");
            }}
          >
            Delete definition
          </button>
        </div>
      </ReactModal>

      {!state.is_current && (
        <div className="mb-5 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
          You are viewing historical revision {state.revision}.{" "}
          <Link to={`/processes/${id}`} className="font-semibold underline">
            View the current revision
          </Link>
          .
        </div>
      )}

      <PageHeading>{state.name}</PageHeading>
      <div className="mb-5 flex flex-wrap gap-2 text-sm font-semibold text-[#6d635d]">
        <span className="rounded bg-[#cdd2d6]/50 px-2 py-1 font-mono">{state.id}</span>
        <span className="rounded bg-[#cdd2d6]/50 px-2 py-1">
          Revision {state.revision}
        </span>
        <span className="rounded bg-[#cdd2d6]/50 px-2 py-1">
          {PROCESS_KIND_LABELS[state.kind]}
        </span>
      </div>

      {state.description ? (
        <p className="whitespace-pre-wrap text-[#04151f]">{state.description}</p>
      ) : (
        <p className="italic text-[#6d635d]">No description.</p>
      )}

      <FormSection title="Expected inputs" bgAccent="bg-accent">
        <Requirements requirements={state.inputs} />
      </FormSection>
      <FormSection title="Expected outputs" bgAccent="bg-accent">
        <Requirements requirements={state.outputs} />
      </FormSection>

      <FormSection title="Operator instructions" bgAccent="bg-dark-accent">
        {state.instructions?.length ? (
          <ol className="list-decimal space-y-2 pl-6">
            {state.instructions.map((instruction, index) => (
              <li key={`${index}-${instruction}`}>{instruction}</li>
            ))}
          </ol>
        ) : (
          <p className="italic text-[#6d635d]">No instructions.</p>
        )}
      </FormSection>

      {Array.isArray(revisions) && revisions.length > 0 && (
        <FormSection title="Revision history" bgAccent="bg-dark-accent">
          <ul className="space-y-1">
            {revisions.map((item) => (
              <li key={item.revision}>
                <Link
                  to={item.is_current
                    ? `/processes/${id}`
                    : `/processes/${id}?revision=${item.revision}`}
                  className={`hover:underline ${
                    item.revision === state.revision
                      ? "font-bold text-[#04151f]"
                      : "text-[#0c3764]"
                  }`}
                >
                  Revision {item.revision}
                </Link>{" "}
                <span className="text-sm text-[#6d635d]">
                  {item.updated_at.slice(0, 10)}
                  {item.is_current ? " · current" : ""}
                </span>
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      {state.is_current &&
        (definition.operations.update || definition.operations.delete) && (
        <div className="mt-8 flex gap-3 border-t border-[#cdd2d6] pt-6">
          {definition.operations.update && (
            <Link
              to={`/processes/${id}/edit`}
              className="rounded-md bg-[#0c3764] px-5 py-3 font-semibold text-white hover:bg-[#082441]"
            >
              Edit definition
            </Link>
          )}
          {definition.operations.delete && (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="rounded-md border border-red-300 px-5 py-3 font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
