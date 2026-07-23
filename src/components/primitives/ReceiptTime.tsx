import * as React from "react";
import { useEffect, useState } from "react";

function stableUtcLabel(value: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function localLabel(value: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Render a deterministic label for SSR/hydration, then switch to the
 * workshop browser's local time after hydration. `dateTime` retains the exact
 * machine-readable instant in either state.
 */
export default function ReceiptTime({ value }: { value: string | null }) {
  const [label, setLabel] = useState(() => stableUtcLabel(value));

  useEffect(() => {
    setLabel(localLabel(value));
  }, [value]);

  if (!value) return <span>{label}</span>;
  return <time dateTime={value}>{label}</time>;
}
