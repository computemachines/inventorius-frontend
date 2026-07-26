import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import "../../styles/PrintButton.css";

export type PrintState =
  | "idle"
  | "submitting"
  | "queued"
  | "printing"
  | "completed"
  | "failed"
  | "disconnected"
  | "unknown";

interface PrintStatus {
  state: PrintState;
  message: string | null;
}

interface PrintButtonProps {
  value: string;
  /** Submit once when this persisted identity first appears. */
  autoPrint?: boolean;
  onStateChange?: (state: PrintState) => void;
}

interface Printer {
  guid: string;
  status: string;
}

type JsonRequestResult =
  | {
      kind: "response";
      ok: boolean;
      status: number;
      body: unknown;
      jsonReadable: boolean;
    }
  | { kind: "timeout" }
  | { kind: "network-error" }
  | { kind: "cancelled" };

const POLL_INTERVAL_MS = 500;
const PRINT_CONFIRMATION_TIMEOUT_MS = 30000;
const PRINTER_LIST_TIMEOUT_MS = 5000;
const JOB_SUBMISSION_TIMEOUT_MS = 10000;
const JOB_STATUS_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === "string"
    ? body.error
    : fallback;
}

/**
 * These are the only failures the print-service contract documents before it
 * attempts to publish a job. Everything else could be an application, proxy,
 * or gateway response produced after the physical consequence began.
 */
function isDocumentedPreSubmissionRejection(
  status: number,
  body: unknown,
): boolean {
  if (!isRecord(body) || typeof body.error !== "string") return false;
  if (status === 404) return body.error === "Printer not found";
  if (status === 503) {
    return body.error_code === "service_disconnected";
  }
  if (status !== 400) return false;

  return [
    "Request body required",
    "printer_guid required",
    "code required",
  ].includes(body.error);
}

/**
 * Submit and monitor one label print job.
 *
 * A failure is called safe only while no job-submission request has happened,
 * or when the service returns one of its documented pre-submission 4xx
 * rejections. Once submission may have occurred, uncertainty remains visible
 * until the operator deliberately accepts the risk of a duplicate label.
 */
function PrintButton({
  value,
  autoPrint = false,
  onStateChange,
}: PrintButtonProps) {
  const [status, setStatus] = useState<PrintStatus>({
    state: "idle",
    message: null,
  });
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const autoPrintTimerRef = useRef<number | null>(null);
  const autoPrintedValueRef = useRef<string | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const isCurrent = useCallback(
    (generation: number) =>
      mountedRef.current && generationRef.current === generation,
    [],
  );

  const requestJson = useCallback(
    async (
      generation: number,
      input: RequestInfo | URL,
      init: RequestInit | undefined,
      timeoutMs: number,
    ): Promise<JsonRequestResult> => {
      if (!isCurrent(generation)) return { kind: "cancelled" };

      const controller = new AbortController();
      activeRequestRef.current?.abort();
      activeRequestRef.current = controller;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        if (!isCurrent(generation)) return { kind: "cancelled" };

        try {
          const body: unknown = await response.json();
          if (!isCurrent(generation)) return { kind: "cancelled" };
          return {
            kind: "response",
            ok: response.ok,
            status: response.status,
            body,
            jsonReadable: true,
          };
        } catch {
          if (timedOut) return { kind: "timeout" };
          if (controller.signal.aborted || !isCurrent(generation)) {
            return { kind: "cancelled" };
          }
          return {
            kind: "response",
            ok: response.ok,
            status: response.status,
            body: null,
            jsonReadable: false,
          };
        }
      } catch {
        if (timedOut) return { kind: "timeout" };
        if (controller.signal.aborted || !isCurrent(generation)) {
          return { kind: "cancelled" };
        }
        return { kind: "network-error" };
      } finally {
        window.clearTimeout(timeout);
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
      }
    },
    [isCurrent],
  );

  const finish = useCallback(
    (
      generation: number,
      state: Extract<
        PrintState,
        "completed" | "failed" | "disconnected" | "unknown"
      >,
      message: string,
    ) => {
      if (!isCurrent(generation)) return;
      clearPollTimer();
      busyRef.current = false;
      setStatus({ state, message });
    },
    [clearPollTimer, isCurrent],
  );

  const startPrint = useCallback(async () => {
    if (busyRef.current || !value) return;

    const generation = ++generationRef.current;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    busyRef.current = true;
    clearPollTimer();
    setStatus({ state: "submitting", message: "Checking the printer…" });

    const printersResult = await requestJson(
      generation,
      "/api/print/printers",
      undefined,
      PRINTER_LIST_TIMEOUT_MS,
    );
    if (printersResult.kind === "cancelled") return;
    if (printersResult.kind === "timeout") {
      finish(
        generation,
        "failed",
        "Checking the printer timed out. No job was submitted.",
      );
      return;
    }
    if (printersResult.kind === "network-error") {
      finish(
        generation,
        "failed",
        "The print service could not be reached. No job was submitted.",
      );
      return;
    }
    if (!printersResult.ok) {
      finish(
        generation,
        "failed",
        "The printer list could not be loaded. No job was submitted.",
      );
      return;
    }
    if (!printersResult.jsonReadable || !isRecord(printersResult.body)) {
      finish(
        generation,
        "failed",
        "The printer list was unreadable. No job was submitted.",
      );
      return;
    }

    const serviceConnected = printersResult.body.service_connected;
    const printers = printersResult.body.printers;
    if (serviceConnected === false) {
      finish(
        generation,
        "disconnected",
        "The print service is disconnected. No job was submitted.",
      );
      return;
    }
    if (!Array.isArray(printers)) {
      finish(
        generation,
        "failed",
        "The printer list was unreadable. No job was submitted.",
      );
      return;
    }

    const onlinePrinters = printers.filter(
      (printer): printer is Printer =>
        isRecord(printer) &&
        typeof printer.guid === "string" &&
        printer.status === "online",
    );
    const printer =
      onlinePrinters.find(({ guid }) => guid.includes("zebra")) ||
      onlinePrinters[0];

    if (!printer) {
      finish(
        generation,
        "disconnected",
        printers.length
          ? "No printer is online. No job was submitted."
          : "No printer is configured. No job was submitted.",
      );
      return;
    }

    const jobResult = await requestJson(
      generation,
      "/api/print/jobs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_guid: printer.guid,
          code: value,
        }),
      },
      JOB_SUBMISSION_TIMEOUT_MS,
    );
    if (jobResult.kind === "cancelled") return;
    if (jobResult.kind === "timeout") {
      finish(generation, "unknown", "Submitting the print job timed out.");
      return;
    }
    if (jobResult.kind === "network-error") {
      finish(
        generation,
        "unknown",
        "The connection was lost while submitting the print job.",
      );
      return;
    }
    if (!jobResult.ok) {
      const message = errorMessage(
        jobResult.body,
        `The print service returned ${jobResult.status} while submitting the job.`,
      );
      if (
        jobResult.jsonReadable &&
        isDocumentedPreSubmissionRejection(jobResult.status, jobResult.body)
      ) {
        finish(
          generation,
          jobResult.status === 503 ? "disconnected" : "failed",
          `${message} No job was submitted.`,
        );
      } else {
        finish(generation, "unknown", message);
      }
      return;
    }
    if (!jobResult.jsonReadable || !isRecord(jobResult.body)) {
      finish(
        generation,
        "unknown",
        "The print service returned an unreadable submission response.",
      );
      return;
    }

    const jobId = jobResult.body.job_id;
    if (typeof jobId !== "string" || !jobId) {
      finish(
        generation,
        "unknown",
        "The print service accepted the request without returning a job ID.",
      );
      return;
    }

    const confirmationDeadline = Date.now() + PRINT_CONFIRMATION_TIMEOUT_MS;
    setStatus({ state: "queued", message: "The label is queued." });

    const poll = async (): Promise<void> => {
      if (!isCurrent(generation)) return;

      const remainingMs = confirmationDeadline - Date.now();
      if (remainingMs <= 0) {
        finish(
          generation,
          "unknown",
          "The printer did not confirm the job before the timeout.",
        );
        return;
      }

      const pollResult = await requestJson(
        generation,
        `/api/print/jobs/${encodeURIComponent(jobId)}`,
        undefined,
        Math.min(JOB_STATUS_TIMEOUT_MS, remainingMs),
      );
      if (pollResult.kind === "cancelled") return;
      if (pollResult.kind === "timeout") {
        finish(
          generation,
          "unknown",
          "Checking the submitted print job timed out.",
        );
        return;
      }
      if (pollResult.kind === "network-error") {
        finish(
          generation,
          "unknown",
          "The submitted print job could not be checked.",
        );
        return;
      }
      if (!pollResult.ok) {
        finish(
          generation,
          "unknown",
          pollResult.status === 404
            ? "The print service no longer knows this submitted job."
            : "The submitted print job could not be checked.",
        );
        return;
      }
      if (!pollResult.jsonReadable || !isRecord(pollResult.body)) {
        finish(
          generation,
          "unknown",
          "The print service returned an unreadable job status.",
        );
        return;
      }

      const jobStatus = pollResult.body.status;
      if (jobStatus === "completed") {
        finish(
          generation,
          "completed",
          "The printer reported that the label completed.",
        );
        return;
      }
      if (jobStatus === "failed") {
        finish(
          generation,
          "failed",
          errorMessage(pollResult.body, "The printer rejected the label."),
        );
        return;
      }
      if (jobStatus === "printing") {
        setStatus({ state: "printing", message: "The label is printing." });
      } else if (jobStatus === "pending") {
        setStatus({ state: "queued", message: "The label is queued." });
      } else {
        finish(
          generation,
          "unknown",
          "The print service returned an unknown job state.",
        );
        return;
      }

      if (!isCurrent(generation)) return;
      pollTimerRef.current = window.setTimeout(
        () => void poll(),
        POLL_INTERVAL_MS,
      );
    };

    pollTimerRef.current = window.setTimeout(
      () => void poll(),
      POLL_INTERVAL_MS,
    );
  }, [clearPollTimer, finish, isCurrent, requestJson, value]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      busyRef.current = false;
      clearPollTimer();
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [clearPollTimer]);

  useEffect(() => {
    onStateChange?.(status.state);
  }, [onStateChange, status.state]);

  useEffect(() => {
    if (!autoPrint || !value || autoPrintedValueRef.current === value) {
      return;
    }

    // Deferring one turn lets React StrictMode discard its trial effect before
    // any network request begins. The surviving effect submits exactly once.
    autoPrintTimerRef.current = window.setTimeout(() => {
      autoPrintTimerRef.current = null;
      if (autoPrintedValueRef.current === value) return;
      autoPrintedValueRef.current = value;
      void startPrint();
    }, 0);

    return () => {
      if (autoPrintTimerRef.current !== null) {
        window.clearTimeout(autoPrintTimerRef.current);
        autoPrintTimerRef.current = null;
      }
    };
  }, [autoPrint, startPrint, value]);

  const canPrint =
    !!value &&
    ["idle", "completed", "failed", "disconnected", "unknown"].includes(
      status.state,
    );

  const buttonText: Record<PrintState, string> = {
    idle: "Print",
    submitting: "Preparing…",
    queued: "Queued…",
    printing: "Printing…",
    completed: "Print again",
    failed: "Retry print",
    disconnected: "Retry print",
    unknown: "Reprint anyway",
  };

  const visibleMessage =
    status.state === "unknown"
      ? `${status.message} The label may already have printed; printing again may make a duplicate.`
      : status.message;

  return (
    <div className="print-control" data-state={status.state}>
      <button
        type="button"
        className="form-print-button"
        onClick={() => void startPrint()}
        disabled={!canPrint}
        data-state={status.state}
      >
        {buttonText[status.state]}
      </button>
      {visibleMessage ? (
        <span className="print-status-message" role="status">
          {visibleMessage}
        </span>
      ) : null}
    </div>
  );
}

export default PrintButton;
