// src/components/features/NewBatchForm.tsx
// Fully human reviewed: NO
// Progress: NONE

import * as React from "react";
import { useContext, useState, useCallback, useEffect, useRef } from "react";
import { useFrontload } from "react-frontload";
import { useLocation } from "react-router-dom";
import { parse } from "query-string";

import { ApiContext, FrontloadContext } from "../../api-client/api-client";
import {
  BatchCreationRequest,
  batchCreateAffordanceProblem,
  isBatchCreateOperation,
} from "../../api-client/data-models";
import { ToastContext } from "../primitives/Toast";
import { useSchemaForm } from "../../hooks/useSchemaForm";
import {
  encodeChangedSchemaValues,
  schemaInputError,
  persistedMixins,
} from "../composites/schema-property-values";
import ItemLabel from "../primitives/ItemLabel";
import PrintButton from "../composites/PrintButton";
import FormSection from "../primitives/FormSection";
import {
  CodesSection,
  CodeEntry,
  createEmptyCode,
} from "../composites/CodesSection";
import {
  SchemaFieldList,
  formatLabel,
  labelClasses,
  inputClasses,
} from "../composites/SchemaFields";
import { usePendingNewBatchCommand } from "./pending-resource-creation";
import { useAuth } from "../auth/AuthContext";

function isDefinitiveRejection(httpStatus: number, type: string): boolean {
  return (
    [400, 409].includes(httpStatus) &&
    [
      "validation-error",
      "duplicate-resource",
      "identifier-space-exhausted",
      "idempotency-conflict",
    ].includes(type)
  );
}

/**
 * Batch creation using the unified trigger schema system.
 *
 * An omitted ID is allocated atomically by the API. The form offers a label
 * print only after the API confirms the canonical persisted ID.
 */
export function NewBatchForm() {
  const location = useLocation();
  const queryParentSkuId = (parse(location.search).parent as string) || "";
  const { data, frontloadMeta } = useFrontload(
    `new-batch-parent-${queryParentSkuId || "none"}`,
    async ({ api }: FrontloadContext) => ({
      parentSku: queryParentSkuId ? await api.getSku(queryParentSkuId) : null,
    }),
  );

  const api = useContext(ApiContext);
  const { applicationOperation } = useAuth();
  const createBatchOperation = applicationOperation("create-batch");
  const affordanceProblem = batchCreateAffordanceProblem(createBatchOperation);
  const { setToastContent } = useContext(ToastContext);
  const pendingCommand = usePendingNewBatchCommand();
  const restoredCommandHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const submissionGenerationRef = useRef(0);

  const schema = useSchemaForm("batch", { useSchemaRoots: true });
  const [batchId, setBatchId] = useState("");
  const [parentSkuId, setParentSkuId] = useState(queryParentSkuId);
  const [parentSkuName, setParentSkuName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [codes, setCodes] = useState<CodeEntry[]>([createEmptyCode()]);
  const [persistedBatchId, setPersistedBatchId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creationOutcomeUnknown, setCreationOutcomeUnknown] = useState(false);
  const [recoveryOnly, setRecoveryOnly] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submissionGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!pendingCommand.ready || restoredCommandHandledRef.current) return;
    restoredCommandHandledRef.current = true;

    if (pendingCommand.pending) {
      setCreationOutcomeUnknown(true);
      setRecoveryOnly(true);
      setValidationError(
        "An earlier batch creation did not receive a confirmed response. Recover that same batch before starting another.",
      );
    }
  }, [pendingCommand.pending, pendingCommand.ready]);

  useEffect(() => {
    if (data?.parentSku?.kind === "sku") {
      setParentSkuName(data.parentSku.state.name || "");
    }
  }, [data?.parentSku]);

  useEffect(() => {
    let cancelled = false;

    if (parentSkuId && parentSkuId !== queryParentSkuId) {
      void api.getSku(parentSkuId).then((result) => {
        if (cancelled) return;
        setParentSkuName(result.kind === "sku" ? result.state.name || "" : "");
      });
    } else if (!parentSkuId) {
      setParentSkuName("");
    }

    return () => {
      cancelled = true;
    };
  }, [parentSkuId, queryParentSkuId, api]);

  const resetForm = useCallback(() => {
    pendingCommand.clear();
    setBatchId("");
    setBatchName("");
    schema.reset();
    setCodes([createEmptyCode()]);
    setParentSkuId(queryParentSkuId);
    setParentSkuName(
      data?.parentSku?.kind === "sku" ? data.parentSku.state.name || "" : "",
    );
    setPersistedBatchId(null);
    setCreationOutcomeUnknown(false);
    setRecoveryOnly(false);
    setValidationError("");
  }, [data?.parentSku, pendingCommand, queryParentSkuId, schema]);

  const buildPayload = (): BatchCreationRequest => {
    const rawSubmitValues = schema.getSubmitValues();
    const encoded = encodeChangedSchemaValues(
      rawSubmitValues,
      schema.availableFields,
      Object.keys(rawSubmitValues),
    );
    if (encoded.invalidNames.length > 0) {
      throw new Error(
        schemaInputError(encoded.invalidNames, schema.availableFields),
      );
    }
    const submitValues = encoded.values;
    const mixins = persistedMixins(
      schema.activeMixins,
      schema.schemaRootMixins,
      schema.implicitRootMixins,
    );
    if (mixins.length > 0) {
      (submitValues as Record<string, unknown>)._mixins =
        mixins;
    }

    const ownedCodes = codes
      .filter((code) => code.value.trim() && code.isOwned)
      .map((code) => code.value.trim());
    const associatedCodes = codes
      .filter((code) => code.value.trim() && !code.isOwned)
      .map((code) => code.value.trim());
    const explicitId = batchId.trim();
    const parentId = parentSkuId.trim();
    const name = batchName.trim();

    return {
      ...(explicitId ? { id: explicitId } : {}),
      ...(parentId ? { sku_id: parentId } : {}),
      ...(name ? { name } : {}),
      ...(ownedCodes.length > 0 ? { owned_codes: ownedCodes } : {}),
      ...(associatedCodes.length > 0
        ? { associated_codes: associatedCodes }
        : {}),
      ...(Object.keys(submitValues).length > 0 ? { props: submitValues } : {}),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

    if (affordanceProblem || !isBatchCreateOperation(createBatchOperation)) {
      setValidationError(
        affordanceProblem ?? "Batch creation is currently unavailable.",
      );
      return;
    }

    let command = pendingCommand.pending;
    if (!command) {
      try {
        command = pendingCommand.getOrCreate(buildPayload());
      } catch (error) {
        setValidationError(
          error instanceof Error ? error.message : "Check the schema field values.",
        );
        return;
      }
    }
    if (!command) {
      setValidationError(
        "This browser cannot preserve a safe retry. Enable session storage before creating a batch.",
      );
      return;
    }

    const submissionGeneration = ++submissionGenerationRef.current;
    setSubmitting(true);
    try {
      const response = await api.createBatch(
        createBatchOperation,
        command.payload,
        command.key,
      );
      if (
        !mountedRef.current ||
        submissionGenerationRef.current !== submissionGeneration
      ) {
        return;
      }

      if (response.kind === "problem") {
        if (isDefinitiveRejection(response.httpStatus, response.type)) {
          pendingCommand.clear();
          setCreationOutcomeUnknown(false);
          setRecoveryOnly(false);
          setValidationError(response.title);
        } else {
          setCreationOutcomeUnknown(true);
          setValidationError(
            "The server did not confirm whether the batch was created. Retry to recover the same batch; do not choose another label.",
          );
        }
        return;
      }

      setPersistedBatchId(response.state.id);
      pendingCommand.clear();
      setCreationOutcomeUnknown(false);
      setRecoveryOnly(false);
      setToastContent({
        content: (
          <p>
            Created <ItemLabel label={response.state.id} />.
          </p>
        ),
        mode: "success",
      });
    } catch {
      if (
        !mountedRef.current ||
        submissionGenerationRef.current !== submissionGeneration
      ) {
        return;
      }
      setCreationOutcomeUnknown(true);
      setValidationError(
        "The creation response was lost. Retry to recover the same batch; do not choose another label.",
      );
    } finally {
      if (
        mountedRef.current &&
        submissionGenerationRef.current === submissionGeneration
      ) {
        setSubmitting(false);
      }
    }
  };

  if (persistedBatchId) {
    return (
      <section
        className="form max-w-[40rem] mx-auto"
        aria-labelledby="new-batch-title"
      >
        <h2
          className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2
            border-[#cdd2d6]"
          id="new-batch-title"
        >
          New Batch
        </h2>
        <p className="form-created-resource">
          Created <ItemLabel label={persistedBatchId} />.
        </p>
        <PrintButton value={persistedBatchId} />
        <button
          type="button"
          className="form-secondary-button"
          onClick={resetForm}
        >
          Create another batch
        </button>
      </section>
    );
  }

  if (recoveryOnly && pendingCommand.pending) {
    return (
      <form
        className="form max-w-[40rem] mx-auto"
        autoComplete="off"
        onSubmit={handleSubmit}
      >
        <h2
          className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2
            border-[#cdd2d6]"
        >
          New Batch
        </h2>
        <p>
          This tab has an unconfirmed batch creation. Its original contents and
          retry identity are preserved.
        </p>
        {validationError ? (
          <p className="form-validation-error" role="alert">
            {validationError}
          </p>
        ) : null}
        <button
          type="submit"
          className="form-submit"
          disabled={
            submitting ||
            !pendingCommand.storageAvailable ||
            affordanceProblem !== null
          }
        >
          {submitting ? "Recovering batch…" : "Recover the same batch"}
        </button>
      </form>
    );
  }

  const sourceField = schema.availableFields.find(
    (field) => field.name === "source",
  );
  const otherFields = schema.availableFields.filter(
    (field) => field.name !== "source",
  );
  const formLocked = submitting || creationOutcomeUnknown;

  if (frontloadMeta.pending) return <div className="p-4">Loading...</div>;
  if (frontloadMeta.error) throw Error("API Error");

  return (
    <form
      className="max-w-[40rem] mx-auto"
      autoComplete="off"
      onSubmit={handleSubmit}
    >
      <h2
        className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2
          border-[#cdd2d6]"
      >
        New Batch
      </h2>

      {schema.error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3
            rounded mb-4"
        >
          {schema.error}
        </div>
      )}

      <fieldset disabled={formLocked} className="m-0 min-w-0 border-0 p-0">
        <label
          htmlFor="batch-id"
          className={labelClasses}
          style={{ marginTop: 0 }}
        >
          Batch ID (optional)
        </label>
        <input
          id="batch-id"
          type="text"
          value={batchId}
          onChange={(event) => setBatchId(event.target.value)}
          placeholder="Leave blank to allocate on creation"
          className={inputClasses}
          spellCheck={false}
        />

        <label htmlFor="parent-sku" className={labelClasses}>
          Parent SKU
        </label>
        <input
          id="parent-sku"
          type="text"
          value={parentSkuId}
          onChange={(event) => setParentSkuId(event.target.value)}
          placeholder="SKU ID (optional)"
          className={inputClasses}
          spellCheck={false}
        />
        {parentSkuName && (
          <p className="mt-1 text-sm text-[#6d635d]">{parentSkuName}</p>
        )}

        <label htmlFor="batch-name" className={labelClasses}>
          Name
        </label>
        <input
          id="batch-name"
          type="text"
          value={batchName}
          onChange={(event) => setBatchName(event.target.value)}
          placeholder={parentSkuName || "Optional"}
          className={inputClasses}
        />

        <FormSection title="Provenance" bgAccent="bg-dark-accent">
          {sourceField && (
            <SchemaFieldList
              fields={[sourceField]}
              values={schema.fieldValues}
              onChange={schema.handleFieldChange}
              entityType="batch"
              triggerFields={{ source: "source" }}
            />
          )}

          {otherFields.length > 0 && (
            <>
              <SchemaFieldList
                fields={otherFields}
                values={schema.fieldValues}
                onChange={schema.handleFieldChange}
                entityType="batch"
              />
              {persistedMixins(
                schema.activeMixins,
                schema.schemaRootMixins,
                schema.implicitRootMixins,
              ).length > 0 && (
                <div
                  className="mt-4 py-2 px-3 text-sm text-[#6d635d]
                    bg-[#cdd2d6]/30 rounded inline-block"
                >
                  Source:{" "}
                  {persistedMixins(
                    schema.activeMixins,
                    schema.schemaRootMixins,
                    schema.implicitRootMixins,
                  ).join(" → ")}
                </div>
              )}
            </>
          )}
        </FormSection>

        <CodesSection codes={codes} setCodes={setCodes} />

        <div className="flex gap-3 mt-8 pt-6 border-t border-[#cdd2d6]">
          <button
            type="button"
            onClick={resetForm}
            className="py-3 px-5 text-base font-medium bg-transparent
              text-[#6d635d] border border-[#cdd2d6] rounded-md
              hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors
              cursor-pointer"
          >
            Reset
          </button>
        </div>
      </fieldset>

      {affordanceProblem ? (
        <p className="form-validation-error" role="alert">
          {affordanceProblem}
        </p>
      ) : !pendingCommand.storageAvailable && pendingCommand.ready ? (
        <p className="form-validation-error" role="alert">
          Session storage is unavailable, so retry-safe batch creation is
          disabled.
        </p>
      ) : validationError ? (
        <p className="form-validation-error" role="alert">
          {validationError}
        </p>
      ) : null}

      <button
        type="submit"
        className="form-submit w-full"
        disabled={
          submitting ||
          affordanceProblem !== null ||
          !pendingCommand.ready ||
          !pendingCommand.storageAvailable
        }
      >
        {submitting
          ? "Creating batch…"
          : creationOutcomeUnknown
            ? "Recover the same batch"
            : "Create batch"}
      </button>

      {schema.loading && (
        <div
          className="fixed bottom-4 right-4 bg-[#082441] text-white px-4 py-2
            rounded-lg shadow-lg"
        >
          Loading...
        </div>
      )}
    </form>
  );
}

export default NewBatchForm;
