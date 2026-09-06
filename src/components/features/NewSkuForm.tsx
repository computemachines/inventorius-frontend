// src/components/features/NewSkuForm.tsx
// Fully human reviewed: NO
// Progress: NONE

import * as React from "react";
import { useContext, useEffect, useRef, useState, useCallback } from "react";

import { ApiContext } from "../../api-client/api-client";
import { SkuCreationRequest } from "../../api-client/data-models";
import { ToastContext } from "../primitives/Toast";
import { useSchemaForm } from "../../hooks/useSchemaForm";
import {
  encodeChangedSchemaValues,
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
import { usePendingNewSkuCommand } from "./pending-resource-creation";

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
 * SKU creation using the unified trigger schema system.
 *
 * The server allocates an omitted ID. Nothing printable exists until that
 * persisted, canonical ID comes back in the successful response.
 */
export function NewSkuForm() {
  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const pendingCommand = usePendingNewSkuCommand();
  const restoredCommandHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const submissionGenerationRef = useRef(0);

  const schema = useSchemaForm("sku", { useSchemaRoots: true });
  const [skuId, setSkuId] = useState("");
  const [codes, setCodes] = useState<CodeEntry[]>([createEmptyCode()]);
  const [persistedSkuId, setPersistedSkuId] = useState<string | null>(null);
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
        "An earlier SKU creation did not receive a confirmed response. Recover that same SKU before starting another.",
      );
    }
  }, [pendingCommand.pending, pendingCommand.ready]);

  const resetForm = useCallback(() => {
    pendingCommand.clear();
    setSkuId("");
    schema.reset();
    setCodes([createEmptyCode()]);
    setPersistedSkuId(null);
    setCreationOutcomeUnknown(false);
    setRecoveryOnly(false);
    setValidationError("");
  }, [pendingCommand, schema]);

  const buildPayload = (): SkuCreationRequest => {
    const rawSubmitValues = schema.getSubmitValues();
    const encoded = encodeChangedSchemaValues(
      rawSubmitValues,
      schema.availableFields,
      Object.keys(rawSubmitValues),
    );
    if (encoded.invalidNames.length > 0) {
      throw new Error(
        `Enter a complete number for ${encoded.invalidNames.map(formatLabel).join(", ")}.`,
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
    const explicitId = skuId.trim();

    return {
      ...(explicitId ? { id: explicitId } : {}),
      ...(Object.keys(submitValues).length > 0 ? { props: submitValues } : {}),
      ...(ownedCodes.length > 0 ? { owned_codes: ownedCodes } : {}),
      ...(associatedCodes.length > 0
        ? { associated_codes: associatedCodes }
        : {}),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");

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
        "This browser cannot preserve a safe retry. Enable session storage before creating a SKU.",
      );
      return;
    }

    const submissionGeneration = ++submissionGenerationRef.current;
    setSubmitting(true);
    try {
      const response = await api.createSku(command.payload, command.key);
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
            "The server did not confirm whether the SKU was created. Retry to recover the same SKU; do not choose another label.",
          );
        }
        return;
      }

      setPersistedSkuId(response.state.id);
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
        "The creation response was lost. Retry to recover the same SKU; do not choose another label.",
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

  if (persistedSkuId) {
    return (
      <section
        className="form max-w-[40rem] mx-auto"
        aria-labelledby="new-sku-title"
      >
        <h2
          className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2
            border-[#cdd2d6]"
          id="new-sku-title"
        >
          New SKU
        </h2>
        <p className="form-created-resource">
          Created <ItemLabel label={persistedSkuId} />.
        </p>
        <PrintButton value={persistedSkuId} />
        <button
          type="button"
          className="form-secondary-button"
          onClick={resetForm}
        >
          Create another SKU
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
          New SKU
        </h2>
        <p>
          This tab has an unconfirmed SKU creation. Its original contents and
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
          disabled={submitting || !pendingCommand.storageAvailable}
        >
          {submitting ? "Recovering SKU…" : "Recover the same SKU"}
        </button>
      </form>
    );
  }

  const itemTypeField = schema.availableFields.find(
    (field) => field.name === "item_type",
  );
  const otherFields = schema.availableFields.filter(
    (field) => field.name !== "item_type",
  );
  const formLocked = submitting || creationOutcomeUnknown;

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
        New SKU
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
          htmlFor="sku-id"
          className={labelClasses}
          style={{ marginTop: 0 }}
        >
          SKU ID (optional)
        </label>
        <input
          id="sku-id"
          type="text"
          value={skuId}
          onChange={(event) => setSkuId(event.target.value)}
          placeholder="Leave blank to allocate on creation"
          className={inputClasses}
          spellCheck={false}
        />

        {itemTypeField && (
          <SchemaFieldList
            fields={[itemTypeField]}
            values={schema.fieldValues}
            onChange={schema.handleFieldChange}
            entityType="sku"
            triggerFields={{ item_type: "item_type" }}
          />
        )}

        {otherFields.length > 0 && (
          <FormSection
            title={`${schema.fieldValues.item_type || "Item"} Attributes`}
            bgAccent="bg-accent"
          >
            <SchemaFieldList
              fields={otherFields}
              values={schema.fieldValues}
              onChange={schema.handleFieldChange}
              entityType="sku"
            />
            {persistedMixins(
              schema.activeMixins,
              schema.schemaRootMixins,
              schema.implicitRootMixins,
            ).length > 0 && (
              <div
                className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30
                  rounded inline-block"
              >
                Active:{" "}
                {persistedMixins(
                  schema.activeMixins,
                  schema.schemaRootMixins,
                  schema.implicitRootMixins,
                ).join(" → ")}
              </div>
            )}
          </FormSection>
        )}

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

      {!pendingCommand.storageAvailable && pendingCommand.ready ? (
        <p className="form-validation-error" role="alert">
          Session storage is unavailable, so retry-safe SKU creation is
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
          !pendingCommand.ready ||
          !pendingCommand.storageAvailable
        }
      >
        {submitting
          ? "Creating SKU…"
          : creationOutcomeUnknown
            ? "Recover the same SKU"
            : "Create SKU"}
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

export default NewSkuForm;
