import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";

import "../styles/PrintButton.css";

type ButtonState = "idle" | "queued" | "printing";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 30000;

/**
 * Print Label Button Component
 *
 * Submits a print job to the print service API.
 * Automatically selects the first online printer.
 * Tracks job status: idle -> queued -> printing -> idle
 *
 * @category Components
 * @param props
 * @param {string} props.value - The code to be printed as a QR label.
 * @returns {ReactNode}
 */
function PrintButton({ value }: { value: string }) {
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const pollIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    jobIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const pollJobStatus = useCallback(async () => {
    if (!jobIdRef.current) return;

    try {
      const resp = await fetch(`/api/print/jobs/${jobIdRef.current}`);
      if (!resp.ok) {
        // Job not found or error - reset to idle
        cleanup();
        setButtonState("idle");
        return;
      }

      const data = await resp.json();
      const status = data.status;

      if (status === "printing") {
        setButtonState("printing");
      } else if (status === "completed" || status === "failed") {
        cleanup();
        setButtonState("idle");
      }
      // If still "pending", keep polling with current state
    } catch {
      // Network error - reset to idle
      cleanup();
      setButtonState("idle");
    }
  }, [cleanup]);

  const handlePrint = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (buttonState !== "idle" || !value) return;

    setButtonState("queued");

    try {
      // Get available printers
      const printersResp = await fetch("/api/print/printers");
      if (!printersResp.ok) {
        throw new Error("Failed to fetch printers");
      }
      const printersData = await printersResp.json();

      // Find first online printer
      const onlinePrinter = printersData.printers?.find(
        (p: { status: string }) => p.status === "online"
      );

      if (!onlinePrinter) {
        setButtonState("idle");
        return;
      }

      // Submit print job
      const jobResp = await fetch("/api/print/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_guid: onlinePrinter.guid,
          code: value,
        }),
      });

      if (!jobResp.ok) {
        setButtonState("idle");
        return;
      }

      const jobData = await jobResp.json();
      jobIdRef.current = jobData.job_id;

      // Start polling for status updates
      pollIntervalRef.current = window.setInterval(pollJobStatus, POLL_INTERVAL_MS);

      // Set timeout to prevent stuck states
      timeoutRef.current = window.setTimeout(() => {
        cleanup();
        setButtonState("idle");
      }, TIMEOUT_MS);
    } catch {
      setButtonState("idle");
    }
  };

  const buttonText = {
    idle: "Print",
    queued: "Queue",
    printing: "Printing",
  }[buttonState];

  return (
    <button
      className="form-print-button"
      onClick={handlePrint}
      disabled={buttonState !== "idle" || !value}
      data-state={buttonState}
    >
      {buttonText}
    </button>
  );
}

export default PrintButton;
