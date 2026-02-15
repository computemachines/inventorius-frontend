// src/components/composites/PrintButton.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";

import "../../styles/PrintButton.css";

type ButtonState = "idle" | "queued" | "printing" | "error" | "disconnected";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 30000;
const ERROR_DISPLAY_MS = 3000;

/**
 * Print Label Button Component
 *
 * Submits a print job to the print service API.
 * Automatically selects the first online printer.
 * Tracks job status: idle -> queued -> printing -> idle
 * Shows error/disconnected states when service is unavailable.
 *
 * @category Components
 * @param props
 * @param {string} props.value - The code to be printed as a QR label.
 * @returns {ReactNode}
 */
function PrintButton({ value }: { value: string }) {
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
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

  const showError = useCallback((message: string, isDisconnected = false) => {
    cleanup();
    setErrorMessage(message);
    setButtonState(isDisconnected ? "disconnected" : "error");

    // Clear any existing error timeout
    if (errorTimeoutRef.current !== null) {
      clearTimeout(errorTimeoutRef.current);
    }

    // Auto-reset after delay
    errorTimeoutRef.current = window.setTimeout(() => {
      setButtonState("idle");
      setErrorMessage(null);
      errorTimeoutRef.current = null;
    }, ERROR_DISPLAY_MS);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (errorTimeoutRef.current !== null) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
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
      } else if (status === "completed") {
        cleanup();
        setButtonState("idle");
      } else if (status === "failed") {
        showError(data.error || "Print failed");
      }
      // If still "pending", keep polling with current state
    } catch {
      // Network error - show error state
      showError("Network error");
    }
  }, [cleanup, showError]);

  const handlePrint = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (buttonState !== "idle" || !value) return;

    setButtonState("queued");
    setErrorMessage(null);

    try {
      // Get available printers
      const printersResp = await fetch("/api/print/printers");
      if (!printersResp.ok) {
        showError("Failed to fetch printers");
        return;
      }
      const printersData = await printersResp.json();

      // Check if print service is connected to MQTT broker
      if (printersData.service_connected === false) {
        showError("Print service disconnected", true);
        return;
      }

      // Find online printer, preferring Zebra label printer
      const onlinePrinters = printersData.printers?.filter(
        (p: { status: string }) => p.status === "online"
      ) || [];
      const onlinePrinter = onlinePrinters.find(
        (p: { guid: string }) => p.guid.includes("zebra")
      ) || onlinePrinters[0];

      if (!onlinePrinter) {
        // Check if there are any printers at all
        if (!printersData.printers || printersData.printers.length === 0) {
          showError("No printers configured");
        } else {
          showError("No printers online", true);
        }
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
        const errorData = await jobResp.json().catch(() => ({}));

        // Handle specific error codes
        if (errorData.error_code === "service_disconnected") {
          showError("Print service disconnected", true);
        } else {
          showError(errorData.error || "Failed to submit job");
        }
        return;
      }

      const jobData = await jobResp.json();
      jobIdRef.current = jobData.job_id;

      // Start polling for status updates
      pollIntervalRef.current = window.setInterval(pollJobStatus, POLL_INTERVAL_MS);

      // Set timeout to prevent stuck states
      timeoutRef.current = window.setTimeout(() => {
        showError("Print timeout");
      }, TIMEOUT_MS);
    } catch {
      showError("Network error");
    }
  };

  const buttonText = {
    idle: "Print",
    queued: "Queue",
    printing: "Printing",
    error: errorMessage || "Error",
    disconnected: errorMessage || "Offline",
  }[buttonState];

  const isClickable = buttonState === "idle" && !!value;

  return (
    <button
      className="form-print-button"
      onClick={handlePrint}
      disabled={!isClickable}
      data-state={buttonState}
      title={errorMessage || undefined}
    >
      {buttonText}
    </button>
  );
}

export default PrintButton;
