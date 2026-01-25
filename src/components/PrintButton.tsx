import * as React from "react";
import { useState, useContext } from "react";
import { ToastContext } from "./Toast";

import "../styles/PrintButton.css";

/**
 * Print Label Button Component
 *
 * Submits a print job to the print service API.
 * Automatically selects the first online printer.
 *
 * @category Components
 * @param props
 * @param {string} props.value - The code to be printed as a QR label.
 * @returns {ReactNode}
 */
function PrintButton({ value }: { value: string }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { setToastContent } = useContext(ToastContext);

  const handlePrint = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPrinting || !value) return;

    setIsPrinting(true);
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
        setToastContent({
          content: <p>No printer online</p>,
          mode: "failure",
        });
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
        const error = await jobResp.json();
        throw new Error(error.error || "Print failed");
      }

      setToastContent({
        content: <p>Printing {value}</p>,
        mode: "success",
      });
    } catch (err) {
      setToastContent({
        content: <p>{err instanceof Error ? err.message : "Print failed"}</p>,
        mode: "failure",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <button
      className="form-print-button"
      onClick={handlePrint}
      disabled={isPrinting || !value}
    >
      {isPrinting ? "..." : "Print"}
    </button>
  );
}

export default PrintButton;
