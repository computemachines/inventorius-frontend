// src/components/features/NewBin.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)

import * as React from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiContext } from "../../api-client/api-client";

import "../../styles/form.css";

import { ToastContext } from "../primitives/Toast";
import ItemLabel from "../primitives/ItemLabel";
import PrintButton, { PrintState } from "../composites/PrintButton";
import { usePendingNewBinCommand } from "./new-bin-command";

interface PersistedBin {
  id: string;
  props: Record<string, unknown> | null;
}

const PRINT_TERMINAL_STATES: PrintState[] = [
  "completed",
  "failed",
  "disconnected",
  "unknown",
];

function NewBin() {
  const { setToastContent } = useContext(ToastContext);
  const api = useContext(ApiContext);
  const pendingCommand = usePendingNewBinCommand();
  const restoredCommandHandledRef = useRef(false);
  const createAnotherButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);
  const submissionGenerationRef = useRef(0);

  const [binIdValue, setBinIdValue] = useState("");
  const [persistedBin, setPersistedBin] = useState<PersistedBin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creationOutcomeUnknown, setCreationOutcomeUnknown] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [printState, setPrintState] = useState<PrintState>("idle");
  const printOutcomeVisible = PRINT_TERMINAL_STATES.includes(printState);
  const handlePrintStateChange = useCallback((state: PrintState) => {
    setPrintState(state);
  }, []);

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
      setBinIdValue(pendingCommand.pending.payload.id ?? "");
      setCreationOutcomeUnknown(true);
      setValidationError(
        "An earlier creation did not receive a confirmed response. Recover that same bin before starting another.",
      );
    }
  }, [pendingCommand.pending, pendingCommand.ready]);

  useEffect(() => {
    if (persistedBin && printOutcomeVisible) {
      createAnotherButtonRef.current?.focus();
    }
  }, [persistedBin, printOutcomeVisible]);

  if (persistedBin) {
    return (
      <section className="form" aria-labelledby="new-bin-title">
        <h2 className="form-title" id="new-bin-title">
          New Bin
        </h2>
        <p className="form-created-resource">
          Created <ItemLabel label={persistedBin.id} />.
        </p>
        <PrintButton
          value={persistedBin.id}
          autoPrint
          onStateChange={handlePrintStateChange}
        />
        <button
          ref={createAnotherButtonRef}
          type="button"
          className="form-secondary-button"
          disabled={!printOutcomeVisible}
          onClick={() => {
            pendingCommand.clear();
            setPersistedBin(null);
            setPrintState("idle");
            setBinIdValue("");
            setCreationOutcomeUnknown(false);
            setValidationError("");
          }}
        >
          Create another bin
        </button>
      </section>
    );
  }

  return (
    <form
      className="form"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        setValidationError("");

        const explicitId = binIdValue.trim();
        const payload = explicitId ? { id: explicitId } : {};
        const command = pendingCommand.getOrCreate(payload);
        if (!command) {
          setValidationError(
            "This browser cannot preserve a safe retry. Enable session storage before creating a bin.",
          );
          return;
        }

        const submissionGeneration = ++submissionGenerationRef.current;
        setSubmitting(true);
        try {
          const resp = await api.createBin(command.payload, command.key);
          if (
            !mountedRef.current ||
            submissionGenerationRef.current !== submissionGeneration
          ) {
            return;
          }
          if (resp.kind === "problem") {
            if (
              [400, 409].includes(resp.httpStatus) &&
              [
                "validation-error",
                "duplicate-resource",
                "identifier-space-exhausted",
              ].includes(resp.type)
            ) {
              pendingCommand.clear();
              setCreationOutcomeUnknown(false);
              setValidationError(resp.title);
            } else {
              setCreationOutcomeUnknown(true);
              setValidationError(
                "The server did not confirm whether the bin was created. Retry to recover the same bin; do not choose another label.",
              );
            }
            return;
          }

          // A label is printable only after the API has returned the canonical,
          // persisted identity. A lost response deliberately leaves the input
          // and idempotency key intact for a safe retry.
          setPersistedBin(resp.state);
          pendingCommand.clear();
          setToastContent({
            content: (
              <p>
                Created <ItemLabel label={resp.state.id} />.
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
            "The creation response was lost. Retry to recover the same bin; do not choose another label.",
          );
        } finally {
          if (
            mountedRef.current &&
            submissionGenerationRef.current === submissionGeneration
          ) {
            setSubmitting(false);
          }
        }
      }}
    >
      <h2 className="form-title">New Bin</h2>
      <label htmlFor="bin_id" className="form-label">
        Bin label (optional)
      </label>
      <input
        autoFocus
        type="text"
        name="bin_id"
        id="bin_id"
        spellCheck={false}
        readOnly={submitting || creationOutcomeUnknown}
        placeholder="Leave blank to allocate the next label"
        className="form-single-code-input"
        value={binIdValue}
        onChange={(e) => setBinIdValue(e.target.value)}
      />
      {!pendingCommand.storageAvailable && pendingCommand.ready ? (
        <p className="form-validation-error" role="alert">
          Session storage is unavailable, so creating a retry-safe bin is
          disabled.
        </p>
      ) : validationError ? (
        <p className="form-validation-error" role="alert">
          {validationError}
        </p>
      ) : null}
      <button
        type="submit"
        className="form-submit"
        disabled={
          submitting ||
          !pendingCommand.ready ||
          !pendingCommand.storageAvailable
        }
      >
        {submitting
          ? "Creating bin…"
          : creationOutcomeUnknown
            ? "Recover the same bin"
            : "Create and print label"}
      </button>
    </form>
  );
}

export default NewBin;
